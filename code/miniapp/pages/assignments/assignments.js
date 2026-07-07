const app = getApp();

Page({
  data: {
    items: [],
    loading: true
  },

  onShow() {
    this.loadAssignments();
  },

  loadAssignments() {
    app.request({ url: '/student/assignments' })
      .then(res => this.setData({ items: res.items || [], loading: false }))
      .catch(() => this.setData({ loading: false }));
  },

  openDetail(e) {
    const id = e.currentTarget.dataset.id;
    wx.showToast({ title: '作业详情开发中', icon: 'none' });
  }
});
