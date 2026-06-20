// 错题本 — web-view 嵌入 WAP
Page({
  data: { wapUrl: '' },
  onLoad() {
    const app = getApp()
    this.setData({
      wapUrl: `${app.globalData.baseUrl}/m/student/error-book?token=${app.globalData.token}`
    })
  }
})
