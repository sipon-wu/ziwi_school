// app.js — 知微学堂小程序
const BASE_URL = 'https://api.ziwi.cn/api';

App({
  globalData: {
    token: '',
    userInfo: null
  },

  onLaunch() {
    const token = wx.getStorageSync('token');
    if (token) {
      this.globalData.token = token;
      this.checkLogin();
    }
  },

  checkLogin() {
    if (!this.globalData.token) {
      wx.redirectTo({ url: '/pages/login/login' });
    }
  },

  request(options) {
    return new Promise((resolve, reject) => {
      wx.request({
        url: BASE_URL + options.url,
        method: options.method || 'GET',
        data: options.data,
        header: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer ' + (this.globalData.token || '')
        },
        success(res) {
          if (res.statusCode === 200) {
            resolve(res.data);
          } else if (res.statusCode === 401) {
            wx.removeStorageSync('token');
            wx.redirectTo({ url: '/pages/login/login' });
            reject(res.data);
          } else {
            reject(res.data);
          }
        },
        fail(err) {
          wx.showToast({ title: '网络异常', icon: 'none' });
          reject(err);
        }
      });
    });
  }
});
