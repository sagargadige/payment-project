import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';

/**
 * User model — case study: _id, name, email.
 * `passwordHash` and `role` are added so the demo can log in and reach the
 * admin dashboard; they do not change the required fields.
 */
const userSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    email: { type: String, required: true, unique: true, lowercase: true, trim: true, index: true },
    passwordHash: { type: String, required: true, select: false },
    role: { type: String, enum: ['user', 'admin'], default: 'user' },
  },
  { timestamps: true },
);

userSchema.methods.setPassword = async function setPassword(plain) {
  this.passwordHash = await bcrypt.hash(plain, 10);
};

userSchema.methods.verifyPassword = function verifyPassword(plain) {
  return bcrypt.compare(plain, this.passwordHash);
};

userSchema.methods.toSafeJSON = function toSafeJSON() {
  return { _id: this._id, name: this.name, email: this.email, role: this.role };
};

export const User = mongoose.model('User', userSchema);
export default User;
