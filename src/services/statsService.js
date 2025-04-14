// Stats service for storing and retrieving focus statistics
import {
  doc,
  getDoc,
  setDoc,
  updateDoc,
  collection,
  query,
  where,
  getDocs,
  Timestamp,
  arrayUnion,
} from "firebase/firestore";
import { auth, db } from "../utils/firebase.utils";

// Get default empty stats object
const getDefaultStats = () => ({
  sessions: [],
  // Structure of a session:
  // {
  //   id: string (timestamp),
  //   date: Timestamp,
  //   duration: number (seconds),
  //   attentionLosses: [{ timestamp: Timestamp, duration: number (seconds) }],
  //   completed: boolean
  // }
  streakData: {
    currentStreak: 0,
    lastActiveDate: null,
    highestStreak: 0,
    activeDatesThisMonth: [], // Array of date strings "YYYY-MM-DD"
  },
  notifications: [], // Store achieved milestones that need to be shown
});

// Get the current user ID, returns null if not logged in
const getCurrentUserId = () => {
  return auth.currentUser ? auth.currentUser.uid : null;
};

// Get stats document reference
const getStatsDocRef = (userId) => {
  return doc(db, "stats", userId);
};

// Load stats from Firestore
const loadStats = async () => {
  try {
    const userId = getCurrentUserId();

    // If user is not logged in, return default stats
    if (!userId) {
      console.warn(
        "User not logged in. Stats cannot be loaded from Firestore."
      );
      return getDefaultStats();
    }

    const statsDocRef = getStatsDocRef(userId);
    const statsDocSnap = await getDoc(statsDocRef);

    if (statsDocSnap.exists()) {
      return statsDocSnap.data();
    } else {
      // If no stats document exists yet, create one with default stats
      const defaultStats = getDefaultStats();
      await setDoc(statsDocRef, defaultStats);
      return defaultStats;
    }
  } catch (error) {
    console.error("Error loading stats from Firestore:", error);
    return getDefaultStats();
  }
};

// Save stats to Firestore
const saveStats = async (stats) => {
  try {
    const userId = getCurrentUserId();

    if (!userId) {
      console.warn("User not logged in. Stats cannot be saved to Firestore.");
      return false;
    }

    const statsDocRef = getStatsDocRef(userId);
    await setDoc(statsDocRef, stats);
    return true;
  } catch (error) {
    console.error("Error saving stats to Firestore:", error);
    return false;
  }
};

// Start a new focus session
const startSession = async (faceTrackingEnabled = true) => {
  try {
    const userId = getCurrentUserId();

    if (!userId) {
      console.warn(
        "User not logged in. Session cannot be started in Firestore."
      );
      return null;
    }

    console.log("Starting session for user:", userId);
    console.log("Face tracking enabled:", faceTrackingEnabled);
    const sessionId = Date.now().toString();
    const statsDocRef = getStatsDocRef(userId);

    // Get current stats
    const statsDocSnap = await getDoc(statsDocRef);
    let stats;

    if (statsDocSnap.exists()) {
      console.log("Found existing stats document");
      stats = statsDocSnap.data();
    } else {
      console.log("Creating new stats document with default stats");
      stats = getDefaultStats();
    }

    // Create new session
    const newSession = {
      id: sessionId,
      date: Timestamp.now(),
      duration: 0,
      attentionLosses: [],
      completed: false,
      attentionLossStart: null, // Temporary field to track current attention loss
      faceTrackingEnabled: faceTrackingEnabled, // Save whether face tracking was enabled for this session
    };

    console.log("New session created:", newSession);

    // Add session to stats
    if (!stats.sessions) {
      stats.sessions = [];
    }
    stats.sessions.push(newSession);

    // Save updated stats
    await setDoc(statsDocRef, stats);
    console.log("Session added to Firestore");

    return sessionId;
  } catch (error) {
    console.error("Error starting session in Firestore:", error);
    return null;
  }
};

// Update session when completed
const completeSession = async (sessionId, duration) => {
  try {
    const userId = getCurrentUserId();

    if (!userId) {
      console.warn(
        "User not logged in. Session cannot be completed in Firestore."
      );
      return false;
    }

    // Get current stats
    const statsDocRef = getStatsDocRef(userId);
    const statsDocSnap = await getDoc(statsDocRef);

    if (!statsDocSnap.exists()) {
      console.warn("Stats document does not exist for user.");
      return false;
    }

    const stats = statsDocSnap.data();

    if (!stats.sessions) {
      console.warn("No sessions found in stats document");
      return false;
    }

    const sessionIndex = stats.sessions.findIndex((s) => s.id === sessionId);

    if (sessionIndex !== -1) {
      stats.sessions[sessionIndex].completed = true;
      stats.sessions[sessionIndex].duration = duration;

      // Update streak data
      // Track today's date in YYYY-MM-DD format for streak calculations
      const today = new Date();
      const dateString = today.toISOString().split("T")[0];

      if (!stats.streakData) {
        stats.streakData = {
          currentStreak: 0,
          lastActiveDate: null,
          highestStreak: 0,
          activeDatesThisMonth: [],
        };
      }

      // Check if this is a new day compared to the last active date
      if (stats.streakData.lastActiveDate !== dateString) {
        // Add today to active dates if not already present
        if (!stats.streakData.activeDatesThisMonth.includes(dateString)) {
          stats.streakData.activeDatesThisMonth.push(dateString);
        }

        // If yesterday was the last active day, increment streak
        const yesterday = new Date(today);
        yesterday.setDate(yesterday.getDate() - 1);
        const yesterdayString = yesterday.toISOString().split("T")[0];

        if (stats.streakData.lastActiveDate === yesterdayString) {
          stats.streakData.currentStreak += 1;
        } else if (stats.streakData.lastActiveDate !== dateString) {
          // Reset streak if there was a gap (but don't reset if we already logged today)
          stats.streakData.currentStreak = 1;
        }

        // Update last active date
        stats.streakData.lastActiveDate = dateString;

        // Update highest streak if needed
        if (stats.streakData.currentStreak > stats.streakData.highestStreak) {
          stats.streakData.highestStreak = stats.streakData.currentStreak;
        }
      }

      // Save updated stats
      await setDoc(statsDocRef, stats);
      console.log("Session marked as completed in Firestore");
      return true;
    } else {
      console.warn("Session not found:", sessionId);
    }

    return false;
  } catch (error) {
    console.error("Error completing session in Firestore:", error);
    return false;
  }
};

// Record attention loss - only if face tracking is enabled for the session
const recordAttentionLoss = async (sessionId, isLookingAway) => {
  try {
    const userId = getCurrentUserId();

    if (!userId) {
      console.warn(
        "User not logged in. Attention loss cannot be recorded in Firestore."
      );
      return false;
    }

    console.log(
      `Recording attention ${
        isLookingAway ? "loss start" : "loss end"
      } for session ${sessionId}`
    );

    // Get current stats
    const statsDocRef = getStatsDocRef(userId);
    const statsDocSnap = await getDoc(statsDocRef);

    if (!statsDocSnap.exists()) {
      console.warn("Stats document does not exist for user.");
      return false;
    }

    const stats = statsDocSnap.data();

    if (!stats.sessions) {
      console.warn("No sessions array in stats document");
      return false;
    }

    const sessionIndex = stats.sessions.findIndex((s) => s.id === sessionId);

    if (sessionIndex !== -1) {
      const session = stats.sessions[sessionIndex];

      // Only record attention loss if face tracking was enabled for this session
      if (!session.faceTrackingEnabled) {
        console.log(
          "Face tracking was disabled for this session, skipping attention loss recording"
        );
        return false;
      }

      if (isLookingAway && !session.attentionLossStart) {
        // Start tracking attention loss
        console.log("Starting attention loss tracking");
        session.attentionLossStart = Timestamp.now();
      } else if (!isLookingAway && session.attentionLossStart) {
        // End tracking attention loss
        console.log("Ending attention loss tracking");
        const startTime = session.attentionLossStart.toDate();
        const endTime = new Date();
        const durationSeconds = Math.round((endTime - startTime) / 1000);

        if (!session.attentionLosses) {
          session.attentionLosses = [];
        }

        session.attentionLosses.push({
          timestamp: session.attentionLossStart,
          duration: durationSeconds,
        });

        console.log(
          `Attention loss recorded with duration: ${durationSeconds}s`
        );
        session.attentionLossStart = null;
      }

      await setDoc(statsDocRef, stats);
      console.log("Updated stats saved to Firestore");
      return true;
    } else {
      console.warn("Session not found:", sessionId);
    }

    return false;
  } catch (error) {
    console.error("Error recording attention loss in Firestore:", error);
    return false;
  }
};

// Calculate streak information
const calculateStreak = async () => {
  try {
    const userId = getCurrentUserId();

    if (!userId) {
      console.warn("User not logged in. Cannot calculate streak.");
      return {
        currentStreak: 0,
        highestStreak: 0,
        activeDatesThisMonth: [],
      };
    }

    const statsDocRef = getStatsDocRef(userId);
    const statsDocSnap = await getDoc(statsDocRef);

    if (!statsDocSnap.exists()) {
      console.warn("Stats document does not exist for user.");
      return {
        currentStreak: 0,
        highestStreak: 0,
        activeDatesThisMonth: [],
      };
    }

    const stats = statsDocSnap.data();
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const todayString = today.toISOString().split("T")[0];

    // Get all dates with completed sessions
    const completedSessionDates = stats.sessions
      .filter((session) => session.completed)
      .map((session) => session.date.toDate().toISOString().split("T")[0]);

    // Remove duplicates to get unique active dates
    const uniqueActiveDates = [...new Set(completedSessionDates)].sort();

    // Get only dates from the current month for the calendar view
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const startOfMonthString = startOfMonth.toISOString().split("T")[0];
    const activeDatesThisMonth = uniqueActiveDates.filter(
      (date) => date >= startOfMonthString
    );

    // Calculate streak
    let currentStreak = 0;
    let streakActive = false;
    let lastActiveDate = null;

    // Check if today has any completed sessions
    if (uniqueActiveDates.includes(todayString)) {
      streakActive = true;
      currentStreak = 1;
      lastActiveDate = todayString;
    }

    // Check previous days
    if (uniqueActiveDates.length > 0) {
      // Get the most recent active date
      const mostRecentActiveDate =
        uniqueActiveDates[uniqueActiveDates.length - 1];

      if (!streakActive) {
        // Check if yesterday was active
        const yesterday = new Date(today);
        yesterday.setDate(yesterday.getDate() - 1);
        const yesterdayString = yesterday.toISOString().split("T")[0];

        if (mostRecentActiveDate === yesterdayString) {
          streakActive = true;
          currentStreak = 1;
          lastActiveDate = yesterdayString;
        }
      }

      if (streakActive) {
        // Count backwards to find the streak length
        for (let i = uniqueActiveDates.length - 2; i >= 0; i--) {
          const currentDate = new Date(uniqueActiveDates[i + 1]);
          const prevDate = new Date(uniqueActiveDates[i]);

          // Calculate the difference in days
          const timeDiff = currentDate.getTime() - prevDate.getTime();
          const daysDiff = Math.round(timeDiff / (1000 * 3600 * 24));

          if (daysDiff === 1) {
            currentStreak++;
          } else {
            break;
          }
        }
      }
    }

    // Get highest streak from stored value
    let highestStreak = stats.streakData?.highestStreak || 0;
    if (currentStreak > highestStreak) {
      highestStreak = currentStreak;
    }

    // Check and update streak data in Firestore
    const streakData = {
      currentStreak,
      lastActiveDate,
      highestStreak,
      activeDatesThisMonth,
    };

    // Update streak data in Firestore
    if (
      !stats.streakData ||
      stats.streakData.currentStreak !== currentStreak ||
      stats.streakData.highestStreak !== highestStreak
    ) {
      // Check for streak achievements
      if (currentStreak === 2 || currentStreak === 7) {
        // Add notification for achievement
        if (!stats.notifications) {
          stats.notifications = [];
        }

        const existingNotification = stats.notifications.find(
          (n) => n.type === "streak" && n.value === currentStreak
        );

        if (!existingNotification) {
          stats.notifications.push({
            id: Date.now().toString(),
            type: "streak",
            value: currentStreak,
            message: `Congratulations! You've maintained a ${currentStreak}-day streak!`,
            date: Timestamp.now(),
            read: false,
          });
        }
      }

      // Update the stats document with the new streak data
      stats.streakData = streakData;
      await setDoc(statsDocRef, stats);
    }

    return streakData;
  } catch (error) {
    console.error("Error calculating streak:", error);
    return {
      currentStreak: 0,
      highestStreak: 0,
      activeDatesThisMonth: [],
    };
  }
};

// Calculate attention improvement metrics
const calculateAttentionImprovement = (
  currentPeriodSessions,
  previousPeriodSessions
) => {
  // If there's not enough data, return null
  if (!currentPeriodSessions.length || !previousPeriodSessions.length) {
    return null;
  }

  // Calculate metrics for current period
  const currentAttentionLossesPerSession =
    currentPeriodSessions.reduce(
      (sum, session) => sum + (session.attentionLosses?.length || 0),
      0
    ) / currentPeriodSessions.length;

  // Calculate average focus duration for current period
  let currentAverageFocusDuration = 0;
  const currentTotalAttentionLosses = currentPeriodSessions.reduce(
    (sum, session) => sum + (session.attentionLosses?.length || 0),
    0
  );

  if (currentTotalAttentionLosses > 0) {
    // Total duration of all focus sessions
    const totalFocusDuration = currentPeriodSessions.reduce(
      (sum, session) => sum + session.duration,
      0
    );

    // Total duration of all attention losses
    const totalAttentionLossDuration = currentPeriodSessions.reduce(
      (sum, session) =>
        sum +
        (session.attentionLosses || []).reduce(
          (lossSum, loss) => lossSum + loss.duration,
          0
        ),
      0
    );

    // Average time focusing = (total session time - total attention loss time) / (number of attention losses + 1)
    const netFocusTime = totalFocusDuration - totalAttentionLossDuration;
    currentAverageFocusDuration =
      netFocusTime /
      (currentTotalAttentionLosses + currentPeriodSessions.length);
  }

  // Calculate metrics for previous period
  const previousAttentionLossesPerSession =
    previousPeriodSessions.reduce(
      (sum, session) => sum + (session.attentionLosses?.length || 0),
      0
    ) / previousPeriodSessions.length;

  // Calculate average focus duration for previous period
  let previousAverageFocusDuration = 0;
  const previousTotalAttentionLosses = previousPeriodSessions.reduce(
    (sum, session) => sum + (session.attentionLosses?.length || 0),
    0
  );

  if (previousTotalAttentionLosses > 0) {
    // Total duration of all focus sessions
    const totalFocusDuration = previousPeriodSessions.reduce(
      (sum, session) => sum + session.duration,
      0
    );

    // Total duration of all attention losses
    const totalAttentionLossDuration = previousPeriodSessions.reduce(
      (sum, session) =>
        sum +
        (session.attentionLosses || []).reduce(
          (lossSum, loss) => lossSum + loss.duration,
          0
        ),
      0
    );

    // Average time focusing
    const netFocusTime = totalFocusDuration - totalAttentionLossDuration;
    previousAverageFocusDuration =
      netFocusTime /
      (previousTotalAttentionLosses + previousPeriodSessions.length);
  }

  // Calculate differences and improvements
  const attentionLossDifference =
    previousAttentionLossesPerSession - currentAttentionLossesPerSession;
  const attentionLossImprovement =
    previousAttentionLossesPerSession > 0
      ? (attentionLossDifference / previousAttentionLossesPerSession) * 100
      : 0;

  const focusDurationDifference =
    currentAverageFocusDuration - previousAverageFocusDuration;
  const focusDurationImprovement =
    previousAverageFocusDuration > 0
      ? (focusDurationDifference / previousAverageFocusDuration) * 100
      : 0;

  // Determine simple improvement status
  const fewerAttentionLosses = attentionLossDifference > 0;
  const longerFocusDuration = focusDurationDifference > 0;

  // Return all metrics
  return {
    attentionLosses: {
      current: currentAttentionLossesPerSession,
      previous: previousAttentionLossesPerSession,
      difference: attentionLossDifference,
      percentImprovement: attentionLossImprovement,
      improved: fewerAttentionLosses,
    },
    focusDuration: {
      current: currentAverageFocusDuration,
      previous: previousAverageFocusDuration,
      difference: focusDurationDifference,
      percentImprovement: focusDurationImprovement,
      improved: longerFocusDuration,
    },
    overallImproved: fewerAttentionLosses || longerFocusDuration,
  };
};

// Calculate focus quality score
const calculateFocusQuality = (sessions) => {
  if (!sessions.length) {
    return {
      score: 0,
      level: "No Data",
      breakdown: {
        completionRate: 0,
        averageFocusDuration: 0,
        attentionLossesInverse: 0,
      },
      rawPercentages: {
        completionRate: 0,
        focusDuration: 0,
        attentionControl: 0,
      },
    };
  }

  // Calculate completion rate (weight: 40%)
  const completedSessions = sessions.filter(
    (session) => session.completed
  ).length;
  const completionRate = (completedSessions / sessions.length) * 100;
  const completionRateScore = completionRate * 0.4;

  // Calculate average focus duration (weight: 30%)
  let averageFocusDuration = 0;
  const totalAttentionLosses = sessions.reduce(
    (sum, session) => sum + (session.attentionLosses?.length || 0),
    0
  );

  if (totalAttentionLosses > 0) {
    // Total duration of all focus sessions
    const totalFocusDuration = sessions.reduce(
      (sum, session) => sum + session.duration,
      0
    );

    // Total duration of all attention losses
    const totalAttentionLossDuration = sessions.reduce(
      (sum, session) =>
        sum +
        (session.attentionLosses || []).reduce(
          (lossSum, loss) => lossSum + loss.duration,
          0
        ),
      0
    );

    const netFocusTime = totalFocusDuration - totalAttentionLossDuration;
    averageFocusDuration =
      netFocusTime / (totalAttentionLosses + sessions.length);
  }

  // Normalize average focus duration score (assuming 20 minutes is 100%)
  const maxFocusDuration = 20 * 60; // 20 minutes in seconds
  const focusDurationRate =
    Math.min(averageFocusDuration / maxFocusDuration, 1) * 100;
  const focusDurationScore = focusDurationRate * 0.3;

  // Calculate attention losses inverse (fewer is better) (weight: 30%)
  const avgAttentionLossesPerSession = totalAttentionLosses / sessions.length;
  // Inverse scoring: 0 losses = 100%, 10+ losses = 0%
  const maxAcceptableLosses = 10;
  const attentionLossRate =
    Math.max(0, 1 - avgAttentionLossesPerSession / maxAcceptableLosses) * 100;
  const attentionLossScore = attentionLossRate * 0.3;

  // Calculate total score
  const totalScore = Math.round(
    completionRateScore + focusDurationScore + attentionLossScore
  );

  // Determine level based on score
  let level = "Poor Focus";
  if (totalScore >= 90) {
    level = "Excellent Focus";
  } else if (totalScore >= 70) {
    level = "Good Focus";
  } else if (totalScore >= 50) {
    level = "Average Focus";
  } else if (totalScore >= 30) {
    level = "Needs Improvement";
  }

  return {
    score: totalScore,
    level,
    breakdown: {
      completionRate: Math.round(completionRateScore),
      averageFocusDuration: Math.round(focusDurationScore),
      attentionLossesInverse: Math.round(attentionLossScore),
    },
    rawPercentages: {
      completionRate: Math.round(completionRate),
      focusDuration: Math.round(focusDurationRate),
      attentionControl: Math.round(attentionLossRate),
    },
  };
};

// Get notifications and mark them as read
const getNotifications = async () => {
  try {
    const userId = getCurrentUserId();

    if (!userId) {
      console.warn("User not logged in. Cannot get notifications.");
      return [];
    }

    const statsDocRef = getStatsDocRef(userId);
    const statsDocSnap = await getDoc(statsDocRef);

    if (!statsDocSnap.exists()) {
      return [];
    }

    const stats = statsDocSnap.data();
    const notifications = stats.notifications || [];

    // Mark all notifications as read
    if (notifications.length > 0) {
      const updatedNotifications = notifications.map((notif) => ({
        ...notif,
        read: true,
      }));

      stats.notifications = updatedNotifications;
      await setDoc(statsDocRef, stats);
    }

    return notifications;
  } catch (error) {
    console.error("Error getting notifications:", error);
    return [];
  }
};

// Helper to filter sessions based on face tracking setting
const getSessionsWithFaceTracking = (sessions) => {
  if (!sessions) return [];
  return sessions.filter((session) => session.faceTrackingEnabled !== false);
};

// Helper function to filter sessions by time range
const filterSessionsByTimeRange = (sessions, range) => {
  if (!sessions || sessions.length === 0) return [];

  const now = new Date();
  let rangeStartDate;

  if (range === "today") {
    rangeStartDate = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  } else if (range === "week") {
    rangeStartDate = new Date(now);
    rangeStartDate.setDate(now.getDate() - now.getDay()); // Sunday as first day
    rangeStartDate.setHours(0, 0, 0, 0);
  } else if (range === "month") {
    rangeStartDate = new Date(now.getFullYear(), now.getMonth(), 1);
  } else {
    // 'all' range doesn't need filtering
    rangeStartDate = new Date(0); // beginning of time
  }

  return sessions.filter((session) => session.date.toDate() >= rangeStartDate);
};

// Helper function to prepare chart data
const prepareChartData = (sessions, range) => {
  const now = new Date();
  const dailyStats = {};
  const last7Days = [];

  // Get the last 7 days
  for (let i = 6; i >= 0; i--) {
    const date = new Date(now);
    date.setDate(date.getDate() - i);
    date.setHours(0, 0, 0, 0);
    const dateString = date.toISOString().split("T")[0];
    dailyStats[dateString] = { attentionLosses: 0, focusTime: 0 };
    last7Days.push(dateString);
  }

  // Aggregate data by day
  const completedSessions = sessions.filter((s) => s.completed);
  completedSessions.forEach((session) => {
    const dateString = session.date.toDate().toISOString().split("T")[0];
    if (dailyStats[dateString]) {
      // Count attention losses
      dailyStats[dateString].attentionLosses +=
        session.attentionLosses?.length || 0;

      // Add focus time (in minutes)
      dailyStats[dateString].focusTime += Math.round(
        (session.duration || 0) / 60
      );
    }
  });

  // Format data for charts
  return {
    labels: last7Days.map((date) => {
      const [year, month, day] = date.split("-");
      return `${month}/${day}`;
    }),
    dailyAttentionLosses: last7Days.map(
      (date) => dailyStats[date].attentionLosses
    ),
    dailyFocusTime: last7Days.map((date) => dailyStats[date].focusTime),
  };
};

// Helper function to calculate improvement stats
const calculateImprovementStats = (sessions) => {
  // If no sessions, return default values
  if (!sessions || sessions.length === 0) {
    return {
      focusTimeChange: 0,
      attentionLossChange: 0,
    };
  }

  // For simplicity, just return placeholder values
  // In a real implementation, this would compare current period to previous
  return {
    focusTimeChange: 0, // Percentage change in focus time
    attentionLossChange: 0, // Percentage change in attention losses
  };
};

// Get stats filtered by time range
const getStatsByTimeRange = async (range) => {
  try {
    const stats = await loadStats();
    const { sessions, streakData } = stats;

    if (!sessions || sessions.length === 0) {
      return {
        totalSessions: 0,
        totalAttentionLosses: 0,
        averageFocusDuration: 0,
        chartData: {
          dailyFocusTime: [],
          dailyAttentionLosses: [],
        },
        streak: streakData || {
          currentStreak: 0,
          highestStreak: 0,
          activeDatesThisMonth: [],
        },
        focusQuality: 0,
        improvementStats: {
          focusTimeChange: 0,
          attentionLossChange: 0,
        },
      };
    }

    // Filter sessions based on time range
    const filteredSessions = filterSessionsByTimeRange(sessions, range);

    // Calculate basic statistics (tracked for all sessions)
    const allCompletedSessions = filteredSessions.filter((s) => s.completed);

    // Total completed sessions (track this regardless of face tracking status)
    const totalSessions = allCompletedSessions.length;

    // For attention-related stats, only use sessions with face tracking
    const sessionsWithFaceTracking =
      getSessionsWithFaceTracking(allCompletedSessions);

    // Initialize attention-related stats
    let totalAttentionLosses = 0;
    let averageFocusDuration = 0;
    let focusQuality = 0;

    // Only calculate face tracking dependent stats if we have sessions with tracking enabled
    if (sessionsWithFaceTracking.length > 0) {
      // Calculate total attention losses
      totalAttentionLosses = sessionsWithFaceTracking.reduce(
        (sum, session) => sum + (session.attentionLosses?.length || 0),
        0
      );

      // Calculate average focus duration
      if (totalAttentionLosses > 0) {
        // Calculate total duration of all focus sessions
        const totalFocusDuration = sessionsWithFaceTracking.reduce(
          (sum, session) => sum + session.duration,
          0
        );

        // Total duration of all attention losses
        const totalAttentionLossDuration = sessionsWithFaceTracking.reduce(
          (sum, session) =>
            sum +
            (session.attentionLosses || []).reduce(
              (lossSum, loss) => lossSum + (loss.duration || 0),
              0
            ),
          0
        );

        // Average time focusing = (total session time - total attention loss time) / (number of attention losses + 1)
        const netFocusTime = totalFocusDuration - totalAttentionLossDuration;
        averageFocusDuration =
          netFocusTime /
          (totalAttentionLosses + sessionsWithFaceTracking.length);
      }

      // Calculate focus quality (only for sessions with face tracking)
      focusQuality = calculateFocusQuality(sessionsWithFaceTracking);
    }

    // Daily attention loss statistics for charts
    // Prepare the chart data structures
    const chartData = prepareChartData(filteredSessions, range);

    // Get streak data
    const streak = streakData || {
      currentStreak: 0,
      highestStreak: 0,
      activeDatesThisMonth: [],
    };

    // Calculate improvement stats
    const improvementStats = calculateImprovementStats(filteredSessions);

    return {
      totalSessions,
      totalAttentionLosses,
      averageFocusDuration: Math.round(averageFocusDuration),
      chartData,
      streak,
      focusQuality,
      improvementStats,
    };
  } catch (error) {
    console.error("Error getting stats by time range:", error);
    return {
      totalSessions: 0,
      totalAttentionLosses: 0,
      averageFocusDuration: 0,
      chartData: {
        dailyFocusTime: [],
        dailyAttentionLosses: [],
      },
      streak: {
        currentStreak: 0,
        highestStreak: 0,
        activeDatesThisMonth: [],
      },
      focusQuality: 0,
      improvementStats: {
        focusTimeChange: 0,
        attentionLossChange: 0,
      },
    };
  }
};

// Reset all statistics
const resetStats = async () => {
  try {
    const userId = getCurrentUserId();

    if (!userId) {
      console.warn("User not logged in. Stats cannot be reset in Firestore.");
      return false;
    }

    const statsDocRef = getStatsDocRef(userId);
    await setDoc(statsDocRef, getDefaultStats());
    return true;
  } catch (error) {
    console.error("Error resetting stats in Firestore:", error);
    return false;
  }
};

// Get stats for a specific friend by userId
const getFriendStats = async (friendId, timeRange = "week") => {
  try {
    if (!friendId) {
      console.error("Friend ID is required");
      return null;
    }

    console.log(
      `Loading stats for friend ${friendId} with time range: ${timeRange}`
    );

    // Get the friend's stats document
    const friendStatsDocRef = doc(db, "stats", friendId);
    const friendStatsDocSnap = await getDoc(friendStatsDocRef);

    if (!friendStatsDocSnap.exists()) {
      console.log("No stats found for this friend");
      return {
        totalSessions: 0,
        totalAttentionLosses: 0,
        averageFocusDuration: 0,
        chartData: {
          labels: [],
          sessionsData: [],
          attentionLossesData: [],
        },
        streak: {
          currentStreak: 0,
          highestStreak: 0,
          activeDatesThisMonth: [],
        },
        attentionImprovement: null,
        focusQuality: {
          score: 0,
          level: "No Data",
          breakdown: {
            completionRate: 0,
            averageFocusDuration: 0,
            attentionLossesInverse: 0,
          },
        },
        notifications: [],
      };
    }

    const friendStats = friendStatsDocSnap.data();
    console.log("Friend stats loaded:", friendStats);

    // Process the stats in the same way as we do for the current user
    // For this we'll need to handle the time range filtering manually
    const now = new Date();
    let filteredSessions = [...(friendStats.sessions || [])];

    // Filter sessions by time range
    let rangeStartDate;
    if (timeRange === "today") {
      rangeStartDate = new Date(
        now.getFullYear(),
        now.getMonth(),
        now.getDate()
      );
    } else if (timeRange === "week") {
      rangeStartDate = new Date(now);
      rangeStartDate.setDate(now.getDate() - now.getDay()); // Sunday as first day
      rangeStartDate.setHours(0, 0, 0, 0);
    } else if (timeRange === "month") {
      rangeStartDate = new Date(now.getFullYear(), now.getMonth(), 1);
    } else {
      // 'all' range doesn't need filtering
      rangeStartDate = new Date(0); // beginning of time
    }

    filteredSessions = filteredSessions.filter(
      (session) => session.date.toDate() >= rangeStartDate
    );

    // Process all the stats similar to getStatsByTimeRange
    // Calculate focus quality score
    const focusQuality = calculateFocusQuality(
      filteredSessions.filter((s) => s.completed)
    );

    // Calculate basic statistics
    const completedSessions = filteredSessions.filter((s) => s.completed);

    // Total completed sessions
    const totalSessions = completedSessions.length;

    // Total attention losses
    const totalAttentionLosses = completedSessions.reduce(
      (sum, session) => sum + (session.attentionLosses?.length || 0),
      0
    );

    // Average focus duration
    let averageFocusDuration = 0;

    if (totalAttentionLosses > 0) {
      // Calculate total duration of all focus sessions
      const totalFocusDuration = completedSessions.reduce(
        (sum, session) => sum + session.duration,
        0
      );

      // Total duration of all attention losses
      const totalAttentionLossDuration = completedSessions.reduce(
        (sum, session) =>
          sum +
          (session.attentionLosses || []).reduce(
            (lossSum, loss) => lossSum + loss.duration,
            0
          ),
        0
      );

      // Average time focusing = (total session time - total attention loss time) / (number of attention losses + 1)
      const netFocusTime = totalFocusDuration - totalAttentionLossDuration;
      averageFocusDuration =
        netFocusTime / (totalAttentionLosses + completedSessions.length);
    }

    // Use the same chart data calculation as in getStatsByTimeRange
    // Daily attention loss statistics for charts
    const dailyStats = {};
    const last7DaysForChart = [];

    // Get the last 7 days
    for (let i = 6; i >= 0; i--) {
      const date = new Date(now);
      date.setDate(date.getDate() - i);
      date.setHours(0, 0, 0, 0);
      const dateString = date.toISOString().split("T")[0];
      dailyStats[dateString] = { attentionLosses: 0, sessions: 0 };
      last7DaysForChart.push(dateString);
    }

    // Aggregate data by day
    completedSessions.forEach((session) => {
      const dateString = session.date.toDate().toISOString().split("T")[0];
      if (dailyStats[dateString]) {
        dailyStats[dateString].sessions++;
        dailyStats[dateString].attentionLosses +=
          session.attentionLosses?.length || 0;
      }
    });

    // Format data for charts
    const chartData = {
      labels: last7DaysForChart.map((date) => {
        const [year, month, day] = date.split("-");
        return `${month}/${day}`;
      }),
      attentionLossesData: last7DaysForChart.map(
        (date) => dailyStats[date].attentionLosses
      ),
      sessionsData: last7DaysForChart.map((date) => dailyStats[date].sessions),
    };

    // No need to get notifications for friends
    const notifications = [];

    // Get friend's streak data
    const streak = friendStats.streakData || {
      currentStreak: 0,
      highestStreak: 0,
      activeDatesThisMonth: [],
    };

    return {
      totalSessions,
      totalAttentionLosses,
      averageFocusDuration: Math.round(averageFocusDuration),
      chartData,
      streak,
      attentionImprovement: null, // We don't calculate this for friends
      focusQuality,
      notifications,
    };
  } catch (error) {
    console.error("Error getting friend stats:", error);
    return {
      totalSessions: 0,
      totalAttentionLosses: 0,
      averageFocusDuration: 0,
      chartData: {
        labels: [],
        sessionsData: [],
        attentionLossesData: [],
      },
      streak: {
        currentStreak: 0,
        highestStreak: 0,
        activeDatesThisMonth: [],
      },
      attentionImprovement: null,
      focusQuality: {
        score: 0,
        level: "No Data",
        breakdown: {
          completionRate: 0,
          averageFocusDuration: 0,
          attentionLossesInverse: 0,
        },
      },
      notifications: [],
    };
  }
};

const statsService = {
  startSession,
  completeSession,
  recordAttentionLoss,
  getStatsByTimeRange,
  resetStats,
  calculateStreak,
  getNotifications,
  getFriendStats,
};

export default statsService;
