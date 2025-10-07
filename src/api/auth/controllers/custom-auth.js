'use strict';

const crypto = require('crypto');

module.exports = {
  async sendOtp(ctx) {
    try {
      const { email } = ctx.request.body;

      if (!email) return ctx.badRequest('Email is required');

      // ✅ Check existing user
      const existingUser = await strapi.db.query('plugin::users-permissions.user').findOne({
        where: { email },
      });

      let user;
      if (existingUser) {
        user = existingUser;
      } else {
        // ✅ Create new user if doesn't exist
        user = await strapi.db.query('plugin::users-permissions.user').create({
          data: {
            username: email.split('@')[0],
            email,
            confirmed: false,
          },
        });
      }

      // ✅ Cooldown check (cannot request again within 60 seconds)
      if (user.lastOtpSentAt) {
        const timeSinceLast = (Date.now() - new Date(user.lastOtpSentAt).getTime()) / 1000;
        if (timeSinceLast < 60) {
          const wait = Math.ceil(60 - timeSinceLast);
          return ctx.badRequest(`Please wait ${wait} seconds before requesting another OTP`);
        }
      }

      // ✅ Generate OTP
      const otp = Math.floor(100000 + Math.random() * 900000).toString();

      // ✅ Store OTP + expiry + last sent time
      await strapi.db.query('plugin::users-permissions.user').update({
        where: { id: user.id },
        data: {
          otpCode: otp,
          otpExpiresAt: new Date(Date.now() + 5 * 60 * 1000), // valid for 5 mins
          lastOtpSentAt: new Date(),
        },
      });

      // ✅ Send email
      await strapi.plugins['email'].services.email.send({
        to: email,
        subject: 'Your OTP Code - TechCoding',
        text: `Your OTP code is ${otp}. It will expire in 5 minutes.`,
      });

      ctx.send({
        status: true,
        message: 'OTP sent successfully',
        userId: user.id,
        email: user.email,
      });

    } catch (error) {
      console.error('Error in sendOtp:', error);
      ctx.internalServerError('Failed to send OTP');
    }
  },

  async verifyOtp(ctx) {
    try {
      const { email, otp } = ctx.request.body;

      if (!email || !otp) return ctx.ctx.send({ status: false, message: 'Email and OTP are required' }); // return ctx.badRequest('Email and OTP are required');

      const user = await strapi.db.query('plugin::users-permissions.user').findOne({
        where: { email },
      });

      if (!user) return ctx.ctx.send({ status: false, message: 'User not found' });

      if (!user.otpCode || !user.otpExpiresAt)
        return ctx.ctx.send({ status: false, message: 'Please request a new OTP' }); 

      if (new Date(user.otpExpiresAt) < new Date())
        return ctx.ctx.send({ status: false, message: 'OTP expired, please request a new one' });

      if (user.otpCode !== otp)
        return ctx.ctx.send({ status: false, message: 'Invalid OTP' }); 

      // ✅ OTP verified → confirm user
      await strapi.db.query('plugin::users-permissions.user').update({
        where: { id: user.id },
        data: {
          confirmed: true,
          otpCode: null,
          otpExpiresAt: null,
          lastOtpSentAt: null,
        },
      });

      // ✅ JWT issue
      const token = strapi.plugins['users-permissions'].services.jwt.issue({ id: user.id });

      ctx.send({
        status: true,
        message: 'OTP verified successfully',
        jwt: token,
        user: {
          id: user.id,
          email: user.email,
          username: user.username,
        },
      });

    } catch (error) {
      console.error('Error in verifyOtp:', error);
      ctx.ctx.send({ status: false, message: 'Failed to verify OTP' });
    }
  },

  async resendOtp(ctx) {
  try {
    const { email } = ctx.request.body;

    if (!email) return ctx.send({ status: false, message: 'Email is required' }); 

    // ✅ Find existing user
    const user = await strapi.db.query('plugin::users-permissions.user').findOne({
      where: { email },
    });

    if (!user) return ctx.send({ status: false, message: 'User not found' }); 
    // ✅ Prevent resend if user is already verified
    // if (user.confirmed) {
    //   return ctx.send({ status: false, message: 'User already verified' }); // return ctx.badRequest('User already verified');
    // }

    // ✅ Cooldown check (60 seconds)
    if (user.lastOtpSentAt) {
      const timeSinceLast = (Date.now() - new Date(user.lastOtpSentAt).getTime()) / 1000;
      if (timeSinceLast < 60) {
        const wait = Math.ceil(60 - timeSinceLast);
        return ctx.send({ status: false, message: `Please wait ${wait} seconds before resending OTP` }); 
      }
    }

    // ✅ Add resend counter + limit
    const now = new Date();
    let resendCount = user.resendCount || 0;
    let firstResendAt = user.firstResendAt ? new Date(user.firstResendAt) : null;

    // Reset count after 15 min window
    
    if (!firstResendAt || (now - firstResendAt) > 15 * 60 * 1000) {
      resendCount = 0;
      firstResendAt = now;
    }

    if (resendCount >= 3) {
      return ctx.send({ status: false, message: 'You have reached the maximum OTP resend limit. Try again after 15 minutes.' }); 
    }

    resendCount += 1;

    // ✅ Generate new OTP
    const otp = Math.floor(100000 + Math.random() * 900000).toString();

    // ✅ Update OTP + expiry + resend counters
    await strapi.db.query('plugin::users-permissions.user').update({
      where: { id: user.id },
      data: {
        otpCode: otp,
        otpExpiresAt: new Date(Date.now() + 5 * 60 * 1000),
        lastOtpSentAt: new Date(),
        resendCount,
        firstResendAt,
      },
    });

    // ✅ Send Email
    await strapi.plugins['email'].services.email.send({
      to: email,
      subject: 'Your OTP Code (Resent) - TechCoding',
      text: `Your new OTP code is ${otp}. It will expire in 5 minutes.`,
    });

    ctx.send({
      status: true,
      message: 'OTP resent successfully',
      email: user.email,
      resendCount,
      remaining: 3 - resendCount,
    });
  } catch (error) {
    console.error('Error in resendOtp:', error);
    ctx.send({ status: false, message: 'Failed to resend OTP' });
  }
}

};
