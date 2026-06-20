// 我的 — 原生页面（登录/设置）
Page({
  data: {
    userInfo: null,
    isLogin: false
  },
  onShow() {
    const token = wx.getStorageSync('token')
    if (token) {
      this.setData({ isLogin: true, userInfo: { name: '学生', grade: '三年级', school: '示例小学' } })
    }
  },
  onGetPhoneNumber(e) {
    getApp().getPhoneNumber(e)
    this.setData({ isLogin: true })
  },
  goToSettings() {
    wx.navigateTo({ url: '/pages/settings/settings' })
  },
  logout() {
    wx.removeStorageSync('token')
    this.setData({ isLogin: false, userInfo: null })
    wx.reLaunch({ url: '/pages/index/index' })
  }
})
