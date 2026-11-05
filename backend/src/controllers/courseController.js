import { Course } from '../models/Course.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { notFound } from '../utils/AppError.js';

/** GET /api/courses — public course/product listing. */
export const listCourses = asyncHandler(async (_req, res) => {
  const courses = await Course.find({ active: true }).sort({ createdAt: 1 });
  res.json({ success: true, data: { courses: courses.map((c) => c.toPublicJSON()) } });
});

/** GET /api/courses/:id */
export const getCourse = asyncHandler(async (req, res) => {
  const course = await Course.findById(req.params.id);
  if (!course) throw notFound('Course not found', 'COURSE_NOT_FOUND');
  res.json({ success: true, data: { course: course.toPublicJSON() } });
});

export default { listCourses, getCourse };
