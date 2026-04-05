// api/_lib/emailService.ts
import nodemailer from 'nodemailer';

const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: process.env.EMAIL_USER, // Email gửi đi
    pass: process.env.EMAIL_APP_PASSWORD, // App Password của Gmail
  },
});

export const sendAdminAlert = async (action: string, username: string, details: any) => {
  const mailOptions = {
    from: process.env.EMAIL_USER,
    to: 'vutrhuy81@gmail.com', // Cố định gửi cho Admin
    subject: `[R-SHIELD CẢNH BÁO] Hệ thống ghi nhận thao tác: ${action}`,
    html: `
      <h3>Phát sinh nhật ký hệ thống R-SHIELD</h3>
      <p><strong>Người dùng:</strong> ${username}</p>
      <p><strong>Hành động:</strong> ${action}</p>
      <p><strong>Thời gian:</strong> ${new Date().toLocaleString('vi-VN')}</p>
      <p><strong>Chi tiết:</strong> <pre>${JSON.stringify(details, null, 2)}</pre></p>
    `,
  };
  await transporter.sendMail(mailOptions);
};

export const sendBulkEmailToUsers = async (emails: string[], subject: string, message: string) => {
  const mailOptions = {
    from: process.env.EMAIL_USER,
    to: emails,
    subject: `[R-SHIELD Thông báo] ${subject}`,
    html: `<div style="font-family: Arial, sans-serif;">${message}</div>`,
  };
  await transporter.sendMail(mailOptions);
};
