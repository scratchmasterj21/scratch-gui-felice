const BlockType = require('scratch-vm/src/extension-support/block-type');
const ArgumentType = require('scratch-vm/src/extension-support/argument-type');

class MobileControls {
    constructor(runtime) {
        this.runtime = runtime;
        this.touches = {}; // To store active touches by identifier
        this.touchList = []; // Ordered array of active touches
        this.activeTouchesCount = 0;
        
        // Listen to document touch events
        if (typeof document !== 'undefined') {
            document.addEventListener('touchstart', this._handleTouch.bind(this), {passive: true});
            document.addEventListener('touchmove', this._handleTouch.bind(this), {passive: true});
            document.addEventListener('touchend', this._handleTouchEnd.bind(this), {passive: true});
            document.addEventListener('touchcancel', this._handleTouchEnd.bind(this), {passive: true});
        }
    }

    _handleTouch(e) {
        const canvas = document.querySelector('canvas');
        if (!canvas) return;
        const rect = canvas.getBoundingClientRect();

        this.touchList = [];
        this.touches = {};
        
        // e.touches contains a list of all current touches on the screen
        for (let i = 0; i < e.touches.length; i++) {
            const touch = e.touches[i];
            
            // Map raw screen pixels to Scratch's strict 480x360 coordinate system
            const x = Math.round(480 * ((touch.clientX - rect.left) / rect.width)) - 240;
            const y = 180 - Math.round(360 * ((touch.clientY - rect.top) / rect.height));
            
            const clientX = touch.clientX - rect.left;
            const clientY = touch.clientY - rect.top;
            
            const touchData = { id: i + 1, x, y, clientX, clientY };
            this.touchList.push(touchData);
            this.touches[i + 1] = touchData;
        }
        this.activeTouchesCount = e.touches.length;
    }

    _handleTouchEnd(e) {
        // e.touches automatically updates when fingers are lifted
        this._handleTouch(e);
    }

    getInfo() {
        return {
            id: 'multitouch',
            name: 'Mobile Controls',
            color1: '#0FBD8C',
            color2: '#0DA57A',
            blocks: [
                {
                    opcode: 'supportsTouches',
                    blockType: BlockType.BOOLEAN,
                    text: 'supports touches?'
                },
                {
                    opcode: 'getMaxTouches',
                    blockType: BlockType.REPORTER,
                    text: '# of simultaneous possible'
                },
                {
                    opcode: 'touchingAnyFinger',
                    blockType: BlockType.BOOLEAN,
                    text: 'touching a finger?'
                },
                {
                    opcode: 'touchingFinger',
                    blockType: BlockType.BOOLEAN,
                    text: 'touching finger [FINGER]?',
                    arguments: {
                        FINGER: {
                            type: ArgumentType.NUMBER,
                            defaultValue: 1
                        }
                    }
                },
                {
                    opcode: 'currentTouchingFinger',
                    blockType: BlockType.REPORTER,
                    text: 'current touching finger'
                },
                {
                    opcode: 'getFingersDown',
                    blockType: BlockType.REPORTER,
                    text: 'fingers down'
                },
                {
                    opcode: 'isFingerDown',
                    blockType: BlockType.BOOLEAN,
                    text: 'is finger [FINGER] down?',
                    arguments: {
                        FINGER: {
                            type: ArgumentType.NUMBER,
                            defaultValue: 1
                        }
                    }
                },
                {
                    opcode: 'getFingerX',
                    blockType: BlockType.REPORTER,
                    text: 'finger [FINGER] x',
                    arguments: {
                        FINGER: {
                            type: ArgumentType.NUMBER,
                            defaultValue: 1
                        }
                    }
                },
                {
                    opcode: 'getFingerY',
                    blockType: BlockType.REPORTER,
                    text: 'finger [FINGER] y',
                    arguments: {
                        FINGER: {
                            type: ArgumentType.NUMBER,
                            defaultValue: 1
                        }
                    }
                }
            ]
        };
    }

    getFingersDown() {
        return this.activeTouchesCount;
    }

    supportsTouches() {
        if (typeof window === 'undefined') return false;
        return 'ontouchstart' in window || navigator.maxTouchPoints > 0;
    }

    getMaxTouches() {
        if (typeof navigator === 'undefined') return 0;
        return navigator.maxTouchPoints || 0;
    }

    touchingAnyFinger(args, util) {
        for (let id in this.touches) {
            const touch = this.touches[id];
            if (util.target.isTouchingPoint(touch.clientX, touch.clientY)) {
                return true;
            }
        }
        return false;
    }

    touchingFinger(args, util) {
        const id = parseInt(args.FINGER, 10);
        const touch = this.touches[id];
        if (touch) {
            return util.target.isTouchingPoint(touch.clientX, touch.clientY);
        }
        return false;
    }

    currentTouchingFinger(args, util) {
        for (let id in this.touches) {
            const touch = this.touches[id];
            if (util.target.isTouchingPoint(touch.clientX, touch.clientY)) {
                return id;
            }
        }
        return 0;
    }

    isFingerDown(args) {
        const id = parseInt(args.FINGER, 10);
        return !!this.touches[id];
    }

    getFingerX(args) {
        const id = parseInt(args.FINGER, 10);
        if (this.touches[id]) {
            return this.touches[id].x;
        }
        return 0;
    }

    getFingerY(args) {
        const id = parseInt(args.FINGER, 10);
        if (this.touches[id]) {
            return this.touches[id].y;
        }
        return 0;
    }
}

module.exports = MobileControls;
