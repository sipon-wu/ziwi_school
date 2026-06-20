// 家长签字页 — 原生 Canvas
Page({
  data: {
    hasSignature: false,
    signed: false
  },
  canvasId: 'signCanvas',
  ctx: null,
  drawing: false,

  onReady() {
    this.ctx = wx.createCanvasContext(this.canvasId, this)
  },

  onTouchStart(e) {
    this.drawing = true
    const { x, y } = e.touches[0]
    this.ctx.setStrokeStyle('#1A3A6B')
    this.ctx.setLineWidth(3)
    this.ctx.setLineCap('round')
    this.ctx.beginPath()
    this.ctx.moveTo(x, y)
  },

  onTouchMove(e) {
    if (!this.drawing) return
    const { x, y } = e.touches[0]
    this.ctx.lineTo(x, y)
    this.ctx.stroke()
    this.ctx.draw(true)
    this.setData({ hasSignature: true })
  },

  onTouchEnd() {
    this.drawing = false
  },

  clearSignature() {
    this.ctx.clearRect(0, 0, 375, 200)
    this.ctx.draw()
    this.setData({ hasSignature: false })
  },

  handleSign() {
    if (!this.data.hasSignature) return
    // 导出签名图片
    wx.canvasToTempFilePath({
      canvasId: this.canvasId,
      success: (res) => {
        this.setData({ signed: true })
        // 上传到后端
        wx.showToast({ title: '签字成功', icon: 'success' })
      }
    }, this)
  }
})
