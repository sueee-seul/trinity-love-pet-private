import { createServer } from 'node:http';
import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { attachSpeechWebSocket } from './common/websocket/speech.websocket.js';
import { checkDatabaseConnection } from './config/database.js';
import { connectToMongoDB, checkMongoConnection } from './config/mongodb.js';
import { taskRouter } from './modules/tasks/task.routes.js';
import feedbackRoutes from './routes/feedback.routes.js';
import adminFeedbackRoutes from './routes/admin.feedback.routes.js';
import adminGoogleReviewRoutes from './routes/admin.google.review.routes.js';
import adminGoogleReviewNotificationRoutes from './routes/admin.google.review.notification.routes.js';
import authRoutes from './routes/auth.routes.js';
import petRoutes from './routes/pet.routes.js';
import petIntakeRoutes from './routes/pet.intake.routes.js';
import staffRoutes from './routes/staff.routes.js';
import parentProfileRoutes from './routes/parent.profile.routes.js';
import facilityRoutes from './routes/facility.routes.js';
import staffShiftRoutes from './routes/staff.shift.routes.js';
import petparentpetsRoutes from './routes/petparent.booking.routes.js';
import petparentHomeRoutes from './routes/petparent.home.routes.js';
import petparentVaccinationRoutes from './routes/petparent.vaccination.routes.js';
import petparentLiveCareRoutes from './routes/petparent.livecare.routes.js';
import petparentTranslationRoutes from './routes/petparent.translation.routes.js';
import petparentStaysRoutes from './routes/petparent.stays.routes.js';
import petparentNotificationRoutes from './routes/petparent.notifications.routes.js';
import managerBookingRoutes from './routes/manager.booking.routes.js';
import adminVaccinationRoutes from './routes/admin.vaccination.routes.js';
import conversationRoutes from './routes/conversation.routes.js';
import adminInquiriesRoutes from './routes/admin.inquiries.routes.js';
import reviewerAuthRoutes from './routes/reviewer-auth.routes.js';
import staffDashboardRouter from './routes/staff.dashboard.routes.js';
import reviewRoutes, { reviewSimulatorRoutes } from './routes/review.routes.js';
import profileMediaRoutes from './routes/profile.media.routes.js';
import conciergeRoutes from './routes/concierge.routes.js';
import shareRoutes from './routes/share.routes.js';
import { errorHandler } from './common/middlewares/error.middleware.js';
import { securityHeaders } from './common/middlewares/security-headers.middleware.js';
import { parseTrustProxy } from './config/trust-proxy.js';
import { FEEDBACK_AUDIO_STORAGE_DIRECTORY } from './services/feedback.audio.storage.js';
import { GOOGLE_REVIEW_PHOTO_STORAGE_DIRECTORY } from './services/review.photo.storage.js';
import { kpiRouter } from './routes/kpi.routes.js';
import { startBookingJobs } from './services/booking.jobs.js';
import { startKpiDailySummaryJob } from './services/kpi.daily-summary.job.js';
import { kpiAlertsRouter } from './routes/kpi.alerts.routes.js';
import { startKpiAlertsJob } from './services/kpi.alerts.job.js';
import { kpiReportsRouter } from './routes/kpi.reports.routes.js';
import { startKpiReportsJob } from './services/kpi.report.job.js';

dotenv.config();

const app = express();
const port = Number(process.env.PORT) || 3000;

app.disable('x-powered-by');
app.set('trust proxy', parseTrustProxy(process.env.TRUST_PROXY));
app.use(securityHeaders);

const allowedOrigins = process.env.CORS_ORIGIN
  ? process.env.CORS_ORIGIN.split(',').map((origin) => origin.trim())
  : ['http://localhost:5173', 'http://127.0.0.1:5173'];

app.use(
  cors({
    credentials: true,
    origin: (origin, callback) => {
      if (!origin || allowedOrigins.includes(origin)) {
        callback(null, true);
        return;
      }
      callback(new Error(`Origin ${origin} is not allowed by CORS`));
    },
  }),
);
// Profile and pet images are uploaded directly to object storage. JSON now
// carries only metadata and the resulting URL, so the API does not need a
// multi-megabyte body allowance for base64 image data.
app.use(express.json({ limit: '2mb' }));
app.use(express.urlencoded({ extended: true, limit: '2mb' }));

// Registered before every /api router: the task router requires an employee for any path it sees,
// and a load balancer's probe carries no session.
app.get('/api/health', async (_req, res) => {
  try {
    const databaseTime = await checkDatabaseConnection();
    const mongoConnected = await checkMongoConnection();
    res.json({
      status: 'ok',
      database: 'connected',
      databaseTime,
      mongo: mongoConnected ? 'connected' : 'unavailable',
    });
  } catch (error) {
    console.error('Database health check failed', error);
    res.status(503).json({ status: 'degraded', database: 'unavailable' });
  }
});

app.use('/api/feedback', feedbackRoutes);
app.use('/api/ai', petIntakeRoutes);
app.use('/api/admin/feedback', adminFeedbackRoutes);
app.use('/api/admin/google-reviews', adminGoogleReviewRoutes);
app.use('/api/admin/google-review-notifications', adminGoogleReviewNotificationRoutes);
app.use('/api/auth', authRoutes);
app.use('/api/review-auth', reviewerAuthRoutes);
app.use('/api/profile-media', profileMediaRoutes);
app.use('/api/google-reviews', reviewRoutes);
app.use('/api/reviews/simulator', reviewSimulatorRoutes);
app.use('/api/admin/pets', petRoutes);
app.use('/api/admin/staff', staffRoutes);
app.use('/api/admin/facilities', facilityRoutes);
app.use('/api/admin/bookings', managerBookingRoutes);
app.use('/api/admin/vaccination-certificates', adminVaccinationRoutes);
app.use('/api/parent/profile', parentProfileRoutes);
app.use('/api/admin/staff-shifts', staffShiftRoutes);
app.use('/api/petparent', petparentpetsRoutes);
app.use('/api/petparent', petparentHomeRoutes);
app.use('/api/petparent', petparentVaccinationRoutes);
app.use('/api/petparent/live-care', petparentLiveCareRoutes);
app.use('/api/petparent', petparentTranslationRoutes);
app.use('/api/petparent/stays', petparentStaysRoutes);
app.use('/api/petparent/notifications', petparentNotificationRoutes);
app.use('/api/petparent/conversations', conversationRoutes);
app.use('/api/admin/kpi', kpiRouter);
app.use('/api/admin/kpi-alerts', kpiAlertsRouter);
app.use('/api/admin/kpi-reports', kpiReportsRouter);
app.use('/api/admin/inquiries', adminInquiriesRoutes);
app.use('/api/admin/staff-dashboard', staffDashboardRouter);
// Public AI booking concierge: no session required, budgeted per route.
app.use('/api/concierge', conciergeRoutes);
// Public stay report links for a parent's vet: the signed token is the only key.
app.use('/api/share', shareRoutes);
app.use('/api', taskRouter);

if (process.env.NODE_ENV !== 'production') {
  app.use('/uploads/feedback', express.static(FEEDBACK_AUDIO_STORAGE_DIRECTORY));
  app.use('/uploads/google-reviews', express.static(GOOGLE_REVIEW_PHOTO_STORAGE_DIRECTORY));
}

app.get('/', (req, res) => {
  res.json({ name: 'Wagstay API', status: 'running' });
});

app.use(errorHandler);

if (process.env.NODE_ENV !== 'test') {
  checkDatabaseConnection()
    .then(() => console.log('Connected to PostgreSQL'))
    .catch((error) => console.error('PostgreSQL connection failed', error));

  connectToMongoDB()
    .then(() => console.log('Connected to MongoDB'))
    .catch((error) => console.error('MongoDB connection failed', error));

  // The speech socket shares the HTTP server so one port, one origin list and one cookie cover
  // both the REST API and live dictation. Guests are admitted for the public booking concierge,
  // with tighter limits than signed-in accounts.
  const server = createServer(app);
  attachSpeechWebSocket({ server, allowedOrigins, allowGuests: true });
  server.listen(port, () => {
    console.log(`Server is running at http://localhost:${port}`);
  });

  // Holds cards 48 hours before drop-off, sends the reminder, and flags unrecorded arrivals.
  startBookingJobs();

  // Creates yesterday's KPI summary from 09:00 Auckland (off without KPI_MONGO_URI).
  startKpiDailySummaryJob();

  // Checks the KPI rule alerts every 30 minutes (off without KPI_MONGO_URI).
  startKpiAlertsJob();

  // Creates last week's and last month's KPI reports from 09:00 Auckland (off without KPI_MONGO_URI).
  startKpiReportsJob();
}

export { app };
