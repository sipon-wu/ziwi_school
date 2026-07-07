const app = getApp();

Page({
  data: {
    userName: '',
    schoolName: ''
  },

  onShow() {
    const token = wx.getStorageSync('token');
    if (!token) return;
    // 解析 JWT payload 获取用户名
    try {
      const payload = JSON.parse(atob(token.split('.')[1]));
      this.setData({
        userName: payload.name || '',
        schoolName: ''
      });
    } catch(e) {}
  },

  goPersonal() {
    wx.showToast({ title: '功能开发中', icon: 'none' });
  },

  goReport() {
    wx.showToast({ title: '功能开发中', icon: 'none' });
  },

  goSettings() {
    wx.showToast({ title: '功能开发中', icon: 'none' });
  },

  handleLogout() {
    wx.showModal({
      title: '提示',
      content: '确定退出登录？',
      success: (res) => {
        if (res.confirm) {
          wx.removeStorageSync('token');
          wx.reLaunch({ url: '/pages/login/login' });
        }
      }
    });
  }
});
