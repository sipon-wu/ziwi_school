// 作业列表 — web-view 嵌入 WAP
Page({
  data: {
    wapUrl: ''
  },
  onLoad() {
    const app = getApp()
    this.setData({
      wapUrl: `${app.globalData.baseUrl}/m/student?token=${app.globalData.token}`
    })
  },
  onMessage(e) {
    // web-view 向小程序发送消息（如跳转到批阅详情）
    const data = e.detail.data[0]
    if (data?.path) {
      wx.navigateTo({ url: data.path })
    }
  }
})
