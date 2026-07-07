const app = getApp();

Page({
  data: {
    items: [],
    loading: true
  },

  onShow() {
    app.request({ url: '/student/error-book' })
      .then(res => this.setData({ items: res.items || [], loading: false }))
      .catch(() => this.setData({ loading: false }));
  }
});
