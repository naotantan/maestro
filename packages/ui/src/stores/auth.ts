// localStorage-backed auth store
export const authStore = {
  getApiKey: () => localStorage.getItem('apiKey'),
  getCompanyId: () => localStorage.getItem('companyId'),
  getUserId: () => localStorage.getItem('userId'),
  setAuth(apiKey: string, companyId: string, userId: string) {
    localStorage.setItem('apiKey', apiKey);
    localStorage.setItem('companyId', companyId);
    localStorage.setItem('userId', userId);
  },
  logout() {
    localStorage.removeItem('apiKey');
    localStorage.removeItem('companyId');
    localStorage.removeItem('userId');
  },
};
