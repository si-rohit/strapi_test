module.exports = {
  routes: [
    {
      method: 'POST',
      path: '/auth/send-otp',
      handler: 'custom-auth.sendOtp',
      config: {
        auth: false,
      },
    },
    {
      method: 'POST',
      path: '/auth/verify-otp',
      handler: 'custom-auth.verifyOtp',
      config: {
        auth: false,
      },
    },
    {
      method: 'POST',
      path: '/auth/resend-otp',
      handler: 'custom-auth.resendOtp',
      config: { auth: false },
    },
  ],
};
