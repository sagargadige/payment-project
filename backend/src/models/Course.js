import mongoose from 'mongoose';

/**
 * Course / product model. The price lives here and is the ONLY source of truth
 * for the amount charged — the frontend price is never trusted.
 */
const courseSchema = new mongoose.Schema(
  {
    title: { type: String, required: true, trim: true },
    slug: { type: String, required: true, unique: true, lowercase: true, trim: true },
    description: { type: String, default: '' },
    // Stored in the smallest currency unit (e.g. cents) to avoid float errors.
    price: { type: Number, required: true, min: 0 },
    currency: { type: String, required: true, default: 'USD', uppercase: true },
    imageUrl: { type: String, default: '' },
    active: { type: Boolean, default: true },
  },
  { timestamps: true },
);

courseSchema.methods.toPublicJSON = function toPublicJSON() {
  return {
    _id: this._id,
    title: this.title,
    slug: this.slug,
    description: this.description,
    price: this.price,
    currency: this.currency,
    imageUrl: this.imageUrl,
  };
};

export const Course = mongoose.model('Course', courseSchema);
export default Course;
