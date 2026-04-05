// api/_lib/models.ts
import mongoose from 'mongoose';

const userSchema = new mongoose.Schema({
  username: { type: String, required: true, unique: true },
  password: { type: String, required: true }, // Trong thực tế sẽ lưu hash (Bcrypt)
  email: { type: String, required: true, unique: true },
  role: { type: String, enum: ['ADMIN', 'GUEST'], default: 'GUEST' },
  isActive: { type: Boolean, default: true }
}, { timestamps: true });

const logSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  username: String,
  action: { type: String, required: true }, // VD: 'LOGIN', 'RUN_SIMULATION', 'UPDATE_USER'
  details: mongoose.Schema.Types.Mixed,
  ipAddress: String,
}, { timestamps: true });

export const User = mongoose.models.User || mongoose.model('User', userSchema);
export const AuditLog = mongoose.models.AuditLog || mongoose.model('AuditLog', logSchema);
