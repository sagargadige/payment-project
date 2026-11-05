/**
 * Seed script — creates a sample user, an admin user and sample courses so the
 * payment flow can be demonstrated immediately.
 *
 * Run:  npm run seed   (from the backend/ directory)
 */
import { connectDB, disconnectDB } from '../src/config/db.js';
import { User } from '../src/models/User.js';
import { Course } from '../src/models/Course.js';
import { Order } from '../src/models/Order.js';
import { logger } from '../src/utils/logger.js';

const SAMPLE_USER = {
  name: 'Sample Student',
  email: 'student@example.com',
  password: 'password123',
  role: 'user',
};

const ADMIN_USER = {
  name: 'Store Admin',
  email: 'admin@example.com',
  password: 'admin123',
  role: 'admin',
};

const COURSES = [
  {
    title: 'Full-Stack Web Development Bootcamp',
    slug: 'full-stack-web-development-bootcamp',
    description:
      'Master React, Node.js, Express and MongoDB by building real projects from scratch. Includes PayPal payment integration.',
    price: 4999, // $49.99
    currency: 'USD',
    imageUrl: 'https://images.unsplash.com/photo-1517180102446-f3ece451e9d8?w=800&q=80',
  },
  {
    title: 'PayPal Payment Gateway Masterclass',
    slug: 'paypal-payment-gateway-masterclass',
    description:
      'Learn to integrate the PayPal REST API end to end: create orders, capture payments, webhooks, refunds and going live.',
    price: 2999, // $29.99
    currency: 'USD',
    imageUrl: 'https://images.unsplash.com/photo-1563013544-824ae1b704d3?w=800&q=80',
  },
  {
    title: 'MongoDB for Developers',
    slug: 'mongodb-for-developers',
    description:
      'Design schemas, model relationships and query data efficiently with MongoDB and Mongoose.',
    price: 1999, // $19.99
    currency: 'USD',
    imageUrl: 'https://images.unsplash.com/photo-1544383835-bda2bc66a55d?w=800&q=80',
  },
];

async function upsertUser({ name, email, password, role }) {
  let user = await User.findOne({ email });
  if (!user) {
    user = new User({ name, email, role });
    await user.setPassword(password);
    await user.save();
    logger.info(`Created ${role} user: ${email} / ${password}`);
  } else {
    logger.info(`User already exists: ${email}`);
  }
  return user;
}

async function upsertCourse(data) {
  let course = await Course.findOne({ slug: data.slug });
  if (!course) {
    course = await Course.create(data);
    logger.info(`Created course: ${data.title} ($${(data.price / 100).toFixed(2)})`);
  } else {
    logger.info(`Course already exists: ${data.title}`);
  }
  return course;
}

async function seed() {
  await connectDB();

  logger.info('Seeding database...');

  await upsertUser(SAMPLE_USER);
  await upsertUser(ADMIN_USER);

  for (const c of COURSES) {
    // eslint-disable-next-line no-await-in-loop
    await upsertCourse(c);
  }

  const counts = {
    users: await User.countDocuments(),
    courses: await Course.countDocuments(),
    orders: await Order.countDocuments(),
  };

  logger.info('Seed complete.');
  logger.info(`  Users:   ${counts.users}`);
  logger.info(`  Courses: ${counts.courses}`);
  logger.info(`  Orders:  ${counts.orders}`);
  logger.info('');
  logger.info('Demo logins:');
  logger.info(`  Student -> ${SAMPLE_USER.email} / ${SAMPLE_USER.password}`);
  logger.info(`  Admin   -> ${ADMIN_USER.email} / ${ADMIN_USER.password}`);

  await disconnectDB();
  process.exit(0);
}

seed().catch((err) => {
  logger.error('Seed failed:', err);
  process.exit(1);
});
