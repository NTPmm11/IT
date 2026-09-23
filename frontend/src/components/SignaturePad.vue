<script>
export default {
  name: "SignaturePad",

  props: {
    modelValue: { type: String, default: "" },
    disabled: { type: Boolean, default: false }
  },

  emits: ["update:modelValue"],

  data() {
    return {
      drawing: false,
      hasStroke: false,
      lastPoint: null
    };
  },

  mounted() {
    this.resizeCanvas();
    window.addEventListener("resize", this.resizeCanvas);
    if (this.modelValue) this.paintDataUrl(this.modelValue);
  },

  beforeUnmount() {
    window.removeEventListener("resize", this.resizeCanvas);
  },

  watch: {
    modelValue(value) {
      if (!value) this.clear(false);
    },
    disabled(value) {
      if (value) this.drawing = false;
    }
  },

  methods: {
    canvasEl() {
      return this.$refs.canvas;
    },

    ctx() {
      return this.canvasEl().getContext("2d");
    },

    resizeCanvas() {
      const canvas = this.canvasEl();
      if (!canvas) return;
      const prevDataUrl = this.hasStroke ? canvas.toDataURL("image/png") : this.modelValue;
      const ratio = window.devicePixelRatio || 1;
      const { width, height } = canvas.getBoundingClientRect();
      canvas.width = Math.max(1, width * ratio);
      canvas.height = Math.max(1, height * ratio);
      const ctx = this.ctx();
      ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
      ctx.lineWidth = 2.4;
      ctx.lineCap = "round";
      ctx.lineJoin = "round";
      ctx.strokeStyle = "#0e023b";
      if (prevDataUrl) this.paintDataUrl(prevDataUrl);
    },

    paintDataUrl(dataUrl) {
      const canvas = this.canvasEl();
      const img = new Image();
      img.onload = () => {
        const { width, height } = canvas.getBoundingClientRect();
        this.ctx().clearRect(0, 0, width, height);
        this.ctx().drawImage(img, 0, 0, width, height);
      };
      img.src = dataUrl;
    },

    pointFromEvent(evt) {
      const rect = this.canvasEl().getBoundingClientRect();
      const src = evt.touches && evt.touches.length ? evt.touches[0] : evt;
      return { x: src.clientX - rect.left, y: src.clientY - rect.top };
    },

    start(evt) {
      if (this.disabled) return;
      evt.preventDefault();
      this.drawing = true;
      this.lastPoint = this.pointFromEvent(evt);
    },

    move(evt) {
      if (this.disabled || !this.drawing) return;
      evt.preventDefault();
      const point = this.pointFromEvent(evt);
      const ctx = this.ctx();
      ctx.beginPath();
      ctx.moveTo(this.lastPoint.x, this.lastPoint.y);
      ctx.lineTo(point.x, point.y);
      ctx.stroke();
      this.lastPoint = point;
      this.hasStroke = true;
    },

    end() {
      if (!this.drawing) return;
      this.drawing = false;
      this.emitValue();
    },

    emitValue() {
      this.$emit("update:modelValue", this.hasStroke ? this.canvasEl().toDataURL("image/png") : "");
    },

    clear(emit = true) {
      const canvas = this.canvasEl();
      if (!canvas) return;
      const { width, height } = canvas.getBoundingClientRect();
      this.ctx().clearRect(0, 0, width, height);
      this.hasStroke = false;
      if (emit) this.$emit("update:modelValue", "");
    }
  }
};
</script>

<template>
  <div class="signature-pad" :class="{ 'is-disabled': disabled }">
    <canvas
      ref="canvas"
      class="signature-canvas"
      @mousedown="start"
      @mousemove="move"
      @mouseup="end"
      @mouseleave="end"
      @touchstart="start"
      @touchmove="move"
      @touchend="end"
    ></canvas>
    <div class="signature-actions">
      <span class="signature-hint">เซ็นชื่อในกรอบด้านบนด้วยเมาส์หรือนิ้ว</span>
      <button type="button" class="signature-clear" :disabled="disabled" @click="clear()">
        <i class="fa-solid fa-eraser"></i> ล้างลายเซ็น
      </button>
    </div>
  </div>
</template>

<style scoped>
.signature-pad {
  border: 1.5px dashed #767477e1;
  border-radius: 8px;
  background-color: #fbfbffa9;
  padding: 8px;
}

.signature-pad.is-disabled {
  background-color: #bfc0c2;
}

.signature-canvas {
  width: 100%;
  height: 160px;
  display: block;
  background: #fff;
  border-radius: 6px;
  cursor: crosshair;
  touch-action: none;
}

.signature-pad.is-disabled .signature-canvas {
  cursor: not-allowed;
}

.signature-actions {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-top: 8px;
  gap: 10px;
}

.signature-hint {
  font-size: 0.9rem;
  color: #6b7280;
}

.signature-clear {
  border: 1px solid #465f86;
  background: #fff;
  color: #00075a;
  border-radius: 6px;
  padding: 6px 12px;
  font-size: 0.9rem;
  cursor: pointer;
}

.signature-clear:disabled {
  cursor: not-allowed;
  opacity: 0.6;
}
</style>
