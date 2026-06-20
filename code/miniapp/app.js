// 知微教学小程序
App({
  globalData: {
    userInfo: null,
    token: '',
    baseUrl: 'https://school.ziwi.cn'
  },

  onLaunch() {
    // 从本地存储恢复登录态
    const token = wx.getStorageSync('token')
    if (token) {
      this.globalData.token = token
    }
  },

  // 统一请求封装
  request(options) {
    const { url, data, method = 'GET' } = options
    return new Promise((resolve, reject) => {
      wx.request({
        url: this.globalData.baseUrl + url,
        data,
        method,
        header: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer ' + this.globalData.token
        },
        success(res) {
          if (res.statusCode === 401) {
            wx.removeStorageSync('token')
            wx.reLaunch({ url: '/pages/index/index' })
            reject(new Error('登录已过期'))
          } else if (res.statusCode >= 200 && res.statusCode < 300) {
            resolve(res.data)
          } else {
            reject(new Error(res.data.message || '请求失败'))
          }
        },
        fail(err) {
          wx.showToast({ title: '网络连接失败', icon: 'none' })
          reject(err)
        }
      })
    })
  },

  // 获取用户手机号（微信一键登录）
  getPhoneNumber(e) {
    if (e.detail.errMsg !== 'getPhoneNumber:ok') return
    // 将加密数据发送到后端解密
    this.request({
      url: '/api/v1/auth/wechat-login',
      method: 'POST',
      data: {
        encrypted_data: e.detail.encryptedData,
        iv: e.detail.iv
      }
    }).then(res => {
      this.globalData.token = res.token
      wx.setStorageSync('token', res.token)
    })
  },

  // 跳转 web-view
  openWebView(url) {
    wx.navigateTo({
      url: `/pages/webview/webview?url=${encodeURIComponent(this.globalData.baseUrl + url + '&token=' + this.globalData.token)}`
    })
  }
})
