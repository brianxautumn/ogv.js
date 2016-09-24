/**
 * Proxy object for web worker interface for codec classes.
 *
 * Used by the high-level player interface.
 *
 * @author Brion Vibber <brion@pobox.com>
 * @copyright 2015
 * @license MIT-style
 */
var OGVLoader = require("./OGVLoader.js");
var OGVDemuxerWebM = require("./demux/webm/WebmDemuxer.js");


var audioClassMap = {
    vorbis: 'OGVDecoderAudioVorbis',
    opus: 'OGVDecoderAudioOpus'
};

var videoClassMap = {
    theora: 'OGVDecoderVideoTheora',
    vp8: 'OGVDecoderVideoVP8',
    vp9: 'OGVDecoderVideoVP9'
};

class OGVWrapperCodec {

    constructor(options) {
        this.options = options || {};
        this.suffix = '?version=' + encodeURIComponent(__OGV_FULL_VERSION__);
        this.base = (typeof options.base === 'string') ? (options.base + '/') : '';
        this.type = (typeof options.type === 'string') ? options.type : 'video/ogg';
        this.processing = false;
        this.demuxer = null;
        this.videoDecoder = null;
        this.audioDecoder = null;
        this.flushIter = 0;
        this.loadedMetadata = false;
        this.loadedDemuxerMetadata = false;
        this.loadedAudioMetadata = false;
        this.loadedVideoMetadata = false;
        this.loadedAllMetadata = false;
        this.onseek = null;

        Object.defineProperty(this, 'duration', {
            get: function () {
                if (this.loadedMetadata) {
                    return this.demuxer.duration;
                } else {
                    return NaN;
                }
            }
        });

        Object.defineProperty(this, 'hasAudio', {
            get: function () {
                return this.loadedMetadata && !!this.audioDecoder;
            }
        });

        Object.defineProperty(this, 'audioReady', {
            get: function () {
                return this.hasAudio && this.demuxer.audioReady;
            }
        });

        Object.defineProperty(this, 'audioTimestamp', {
            get: function () {
                return this.demuxer.audioTimestamp;
            }
        });

        Object.defineProperty(this, 'audioFormat', {
            get: function () {
                if (this.hasAudio) {
                    return this.audioDecoder.audioFormat;
                } else {
                    return null;
                }
            }
        });

        Object.defineProperty(this, 'audioBuffer', {
            get: function () {
                if (this.hasAudio) {
                    return this.audioDecoder.audioBuffer;
                } else {
                    return null;
                }
            }
        });

        Object.defineProperty(this, 'hasVideo', {
            get: function () {
                return this.loadedMetadata && !!this.videoDecoder;
            }
        });

        Object.defineProperty(this, 'frameReady', {
            get: function () {
                return this.hasVideo && this.demuxer.frameReady;
            }
        });

        Object.defineProperty(this, 'frameTimestamp', {
            get: function () {
                return this.demuxer.frameTimestamp;
            }
        });

        Object.defineProperty(this, 'keyframeTimestamp', {
            get: function () {
                return this.demuxer.keyframeTimestamp;
            }
        });

        Object.defineProperty(this, 'videoFormat', {
            get: function () {
                if (this.hasVideo) {
                    return this.videoDecoder.videoFormat;
                } else {
                    return null;
                }
            }
        });

        Object.defineProperty(this, 'frameBuffer', {
            get: function () {
                if (this.hasVideo) {
                    return this.videoDecoder.frameBuffer;
                } else {
                    return null;
                }
            }
        });

        Object.defineProperty(this, 'seekable', {
            get: function () {
                return this.demuxer.seekable;
            }
        });

        Object.defineProperty(this, "demuxerCpuTime", {
            get: function () {
                if (this.demuxer) {
                    return this.demuxer.cpuTime;
                } else {
                    return 0;
                }
            }
        });
        Object.defineProperty(this, "audioCpuTime", {
            get: function () {
                if (this.audioDecoder) {
                    return this.audioDecoder.cpuTime;
                } else {
                    return 0;
                }
            }
        });
        Object.defineProperty(this, "videoCpuTime", {
            get: function () {
                if (this.videoDecoder) {
                    return this.videoDecoder.cpuTime;
                } else {
                    return 0;
                }
            }
        });

    }
    // - public methods
    init(callback) {
        var demuxerClassName;
        if (this.options.type === 'video/webm') {
            this.demuxerClassName = 'OGVDemuxerWebM';
        } else {
            this.demuxerClassName = 'OGVDemuxerOgg';
        }
        this.processing = true;
        /**
         * Temp hack just to load the test javascript demuxer, need a better loader
         */

        if (this.demuxerClassName === 'OGVDemuxerWebM') {
            console.info("loading javascript demux");
            this.demuxer = new OGVDemuxerWebM();
            this.demuxer.onseek = function (offset) {
                if (this.onseek) {
                    this.onseek(offset);
                }
            }.bind(this);
            //window.demuxer = demuxer;//testing only
            this.demuxer.init(function () {
                this.processing = false;
                callback();
            }.bind(this));

        } else {

            OGVLoader.loadClass(this.demuxerClassName, function (demuxerClass) {
                this.demuxer = new demuxerClass();
                this.demuxer.onseek = function (offset) {
                    if (this.onseek) {
                        this.onseek(offset);
                    }
                }.bind(this);
                this.demuxer.init(function () {
                    this.processing = false;
                    callback();
                }.bind(this));
            }.bind(this));
        }
    
        console.log(this);
    }

    close() {
        if (this.demuxer) {
            this.demuxer.close();
            this.demuxer = null;
        }
        if (this.videoDecoder) {
            this.videoDecoder.close();
            this.videoDecoder = null;
        }
        if (this.audioDecoder) {
            this.audioDecoder.close();
            this.audioDecoder = null;
        }
    }

    receiveInput(data, callback) {
        this.demuxer.receiveInput(data, callback);
    }

    loadAudioCodec(callback) {


        if (this.demuxer.audioCodec) {
            //console.log(this);
            //throw "FORMAT";

            var className = audioClassMap[this.demuxer.audioCodec];
            //console.log("got audio classname + " + className);
            this.processing = true;
            OGVLoader.loadClass(className, function (audioCodecClass) {
                var audioOptions = {};
                //console.warn(demuxer.audioFormat);
                if (this.demuxer.audioFormat) {
                    audioOptions.audioFormat = this.demuxer.audioFormat;
                }
                this.audioDecoder = new audioCodecClass(audioOptions);
                this.audioDecoder.init(function () {
                    this.loadedAudioMetadata = this.audioDecoder.loadedMetadata;
                    this.processing = false;
                    callback();
                }.bind(this));
            }.bind(this), {
                worker: this.options.worker
            });
        } else {
            callback();
        }
    }

    loadVideoCodec(callback) {
        if (this.demuxer.videoCodec) {
            var className = videoClassMap[this.demuxer.videoCodec];
            //console.log("got video classname + " + className);
            this.processing = true;
            OGVLoader.loadClass(className, function (videoCodecClass) {
                var videoOptions = {};
                if (this.demuxer.videoFormat) {
                    videoOptions.videoFormat = this.demuxer.videoFormat;
                }
                if (this.options.memoryLimit) {
                    videoOptions.memoryLimit = this.options.memoryLimit;
                }
                this.videoDecoder = new videoCodecClass(videoOptions);
                this.videoDecoder.init(function () {
                    this.loadedVideoMetadata = this.videoDecoder.loadedMetadata;
                    this.processing = false;
                    callback();
                }.bind(this));
            }.bind(this), {
                worker: this.options.worker
            });
        } else {
            callback();
        }
    }

    finish(result) {
        this.processing = false;
        var delta = (window.performance ? performance.now() : Date.now()) - this.start;
        if (delta > 8) {
            console.log('slow demux in ' + delta + ' ms; ' +
                    (this.demuxer.videoPackets.length - this.videoPacketCount) + ' +video packets, ' +
                    (this.demuxer.audioPackets.length - this.audioPacketCount) + ' +audio packets');
        }
        //console.log('demux returned ' + (result ? 'true' : 'false') + '; ' + demuxer.videoPackets.length + '; ' + demuxer.audioPackets.length);
        this.callback(result);
    }

    doProcessData() {
        this.videoPacketCount = this.demuxer.videoPackets.length,
                this.audioPacketCount = this.demuxer.audioPackets.length,
                this.start = (window.performance ? performance.now() : Date.now());
        this.demuxer.process(this.finish.bind(this));
    }

    process(callback) {
        this.callback = callback;
        if (this.processing) {
            throw new Error('reentrancy fail on OGVWrapperCodec.process');
        }
        this.processing = true;
        //console.warn("process loop");
        var videoPacketCount = this.demuxer.videoPackets.length;
        this.audioPacketCount = this.demuxer.audioPackets.length;
        this.start = (window.performance ? performance.now() : Date.now());


        if (this.demuxer.loadedMetadata && !this.loadedDemuxerMetadata) {

            // Demuxer just reached its metadata. Load the relevant codecs!
            this.loadAudioCodec(function () {
                this.loadVideoCodec(function () {
                    this.loadedDemuxerMetadata = true;
                    this.loadedAudioMetadata = !this.audioDecoder;
                    this.loadedVideoMetadata = !this.videoDecoder;
                    this.loadedAllMetadata = this.loadedAudioMetadata && this.loadedVideoMetadata;
                    this.finish(true);
                }.bind(this));
            }.bind(this));

        } else if (this.loadedDemuxerMetadata && !this.loadedAudioMetadata) {

            if (this.audioDecoder.loadedMetadata) {

                this.loadedAudioMetadata = true;
                this.loadedAllMetadata = this.loadedAudioMetadata && this.loadedVideoMetadata;
                this.finish(true);

            } else if (this.demuxer.audioReady) {

                this.demuxer.dequeueAudioPacket(function (packet) {
                    this.audioDecoder.processHeader(packet, function (ret) {
                        this.finish(true);
                    }.bind(this));
                }.bind(this));

            } else {

                this.doProcessData();

            }

        } else if (this.loadedAudioMetadata && !this.loadedVideoMetadata) {

            if (this.videoDecoder.loadedMetadata) {

                this.loadedVideoMetadata = true;
                this.loadedAllMetadata = this.loadedAudioMetadata && this.loadedVideoMetadata;
                this.finish(true);

            } else if (this.demuxer.frameReady) {

                this.processing = true;
                this.demuxer.dequeueVideoPacket(function (packet) {
                    this.videoDecoder.processHeader(packet, function () {
                        this.finish(true);
                    }.bind(this));
                }.bind(this));

            } else {

                this.doProcessData();

            }

        } else if (this.loadedVideoMetadata && !this.loadedMetadata && this.loadedAllMetadata) {

            // Ok we've found all the metadata there is. Enjoy.
            this.loadedMetadata = true;
            this.finish(true);

        } else if (this.loadedMetadata && (!this.hasAudio || this.demuxer.audioReady) && (!this.hasVideo || this.demuxer.frameReady)) {

            // Already queued up some packets. Go read them!
            this.finish(true);

        } else {

            // We need to process more of the data we've already received,
            // or ask for more if we ran out!
            this.doProcessData();

        }

    }

    decodeFrame(callback) {
        var cb = this.flushSafe(callback);
        this.timestamp = this.frameTimestamp;
        this.demuxer.dequeueVideoPacket(function (packet) {
            this.videoDecoder.processFrame(packet, function (ok) {
                // hack
                if (this.videoDecoder.frameBuffer) {
                    this.videoDecoder.frameBuffer.timestamp = this.timestamp;
                    this.videoDecoder.frameBuffer.keyframeTimestamp = this.keyframeTimestamp;
                }
                cb(ok);
            }.bind(this));
        }.bind(this));
    }

    decodeAudio(callback) {
        var cb = this.flushSafe(callback);
        this.demuxer.dequeueAudioPacket(function (packet) {

            this.audioDecoder.processAudio(packet, cb);
        }.bind(this));
    }

    discardFrame(callback) {
        this.demuxer.dequeueVideoPacket(function (packet) {
            callback();
        });
    }

    discardAudio(callback) {
        this.demuxer.dequeueAudioPacket(function (packet) {
            callback();
        });
    }

    flush(callback) {
        this.flushIter++;
        this.demuxer.flush(callback);
    }

    getKeypointOffset(timeSeconds, callback) {
        this.demuxer.getKeypointOffset(timeSeconds, callback);
    }

    seekToKeypoint(timeSeconds, callback) {
        this.demuxer.seekToKeypoint(timeSeconds, this.flushSafe(callback));
    }

    /*
     * Notify demuxer that scrubbing is complete, temp hack for now
     * Change this to scrub.
     */
    seekEnd() {
        this.demuxer.onScrubEnd();
    }
    // Wrapper for callbacks to drop them after a flush
    flushSafe(func) {
        var savedFlushIter = this.flushIter;
        return function (arg) {
            if (this.flushIter <= savedFlushIter) {
                func(arg);
            }
        }.bind(this);
    }
}

module.exports = OGVWrapperCodec;
