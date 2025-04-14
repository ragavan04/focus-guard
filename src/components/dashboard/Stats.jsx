import React, { useState, useEffect, useContext } from "react";
import { UserContext } from "../../contexts/user.context";
import statsService from "../../services/statsService";
import "../../styles/Stats.css";

// Info Icon component with tooltip
const InfoIcon = ({ text }) => {
  return (
    <div className="info-icon">
      ⓘ<div className="tooltip">{text}</div>
    </div>
  );
};

const Stats = () => {
  const { currentUser } = useContext(UserContext);
  const [timeRange, setTimeRange] = useState("week");
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  const [stats, setStats] = useState({
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
      rawPercentages: null,
    },
    notifications: [],
  });

  // Load stats when time range changes or user changes
  useEffect(() => {
    const loadStats = async () => {
      setIsLoading(true);
      setError(null);

      try {
        const loadedStats = await statsService.getStatsByTimeRange(timeRange);
        setStats(loadedStats);
      } catch (error) {
        console.error("Error loading stats:", error);
        setError("Failed to load statistics. Please try again later.");
      } finally {
        setIsLoading(false);
      }
    };

    if (currentUser) {
      loadStats();
    } else {
      setIsLoading(false);
    }
  }, [timeRange, currentUser]);

  // Format seconds to minutes:seconds
  const formatTime = (seconds) => {
    if (!seconds) return "0:00";
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs < 10 ? "0" + secs : secs}`;
  };

  // Handle reset stats
  const handleResetStats = async () => {
    if (
      window.confirm(
        "Are you sure you want to reset all statistics? This cannot be undone."
      )
    ) {
      try {
        setIsLoading(true);
        setError(null);
        const result = await statsService.resetStats();

        // Reload stats
        const loadedStats = await statsService.getStatsByTimeRange(timeRange);
        setStats(loadedStats);
      } catch (error) {
        console.error("Error resetting stats:", error);
        setError("Failed to reset statistics. Please try again later.");
      } finally {
        setIsLoading(false);
      }
    }
  };

  // Generate calendar for current month
  const renderCalendar = () => {
    const now = new Date();
    const currentMonth = now.getMonth();
    const currentYear = now.getFullYear();

    // Get first day of month and total days
    const firstDayOfMonth = new Date(currentYear, currentMonth, 1).getDay();
    const daysInMonth = new Date(currentYear, currentMonth + 1, 0).getDate();

    // Create array of day names
    const dayNames = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

    // Create array of active dates
    const activeDates = stats.streak.activeDatesThisMonth.map((dateStr) =>
      new Date(dateStr).getDate()
    );

    // Generate calendar grid
    const calendarDays = [];

    // Add day names
    dayNames.forEach((day) => {
      calendarDays.push(
        <div className="calendar-day-name" key={`header-${day}`}>
          {day}
        </div>
      );
    });

    // Add empty cells for days before start of month
    for (let i = 0; i < firstDayOfMonth; i++) {
      calendarDays.push(
        <div className="calendar-day empty" key={`empty-${i}`}></div>
      );
    }

    // Add days of month
    for (let day = 1; day <= daysInMonth; day++) {
      const isActive = activeDates.includes(day);
      const isToday = day === now.getDate();

      calendarDays.push(
        <div
          className={`calendar-day ${isActive ? "active" : ""} ${
            isToday ? "today" : ""
          }`}
          key={day}
        >
          {day}
          {isActive && <div className="activity-indicator"></div>}
        </div>
      );
    }

    return (
      <div className="calendar-container">
        <InfoIcon text="Displays your active days this month and your current streak. A streak is counted when you complete at least one focus session per day consecutively." />
        <div className="calendar-header">
          <h3>
            {new Date(currentYear, currentMonth).toLocaleString("default", {
              month: "long",
            })}{" "}
            {currentYear}
          </h3>
          <div className="streak-count">
            <span className="streak-label">Current Streak:</span>
            <span className="streak-value">
              {stats.streak.currentStreak} day
              {stats.streak.currentStreak !== 1 ? "s" : ""}
            </span>
          </div>
        </div>
        <div className="calendar-grid">{calendarDays}</div>
      </div>
    );
  };

  // Render focus quality meter
  const renderFocusQualityMeter = () => {
    const { score, level, rawPercentages } = stats.focusQuality;

    return (
      <div className="focus-quality-container">
        <InfoIcon text="Your overall focus quality score (0-100) based on session completion rate (40%), average focus duration (30%), and attention control (30%). Higher scores indicate better focus performance." />
        <h3>Focus Quality Score</h3>

        <div className="focus-quality-score-container">
          <div className="focus-quality-score">{score}%</div>
        </div>

        <div className="focus-quality-meter">
          <div className="focus-quality-background"></div>
          <div
            className="focus-quality-fill"
            style={{ width: `${score}%` }}
          ></div>
          <div
            className="focus-quality-marker"
            style={{ left: `${score}%` }}
          ></div>
        </div>

        <div className="focus-quality-breakdown">
          <div className="breakdown-item">
            <div className="breakdown-label">Completion Rate</div>
            <div className="breakdown-bar">
              <div
                className="breakdown-fill"
                style={{ width: `${rawPercentages?.completionRate || 0}%` }}
              ></div>
            </div>
            <div className="breakdown-value">
              {rawPercentages?.completionRate || 0}%
            </div>
          </div>

          <div className="breakdown-item">
            <div className="breakdown-label">Focus Duration</div>
            <div className="breakdown-bar">
              <div
                className="breakdown-fill"
                style={{ width: `${rawPercentages?.focusDuration || 0}%` }}
              ></div>
            </div>
            <div className="breakdown-value">
              {rawPercentages?.focusDuration || 0}%
            </div>
          </div>

          <div className="breakdown-item">
            <div className="breakdown-label">Attention Control</div>
            <div className="breakdown-bar">
              <div
                className="breakdown-fill"
                style={{ width: `${rawPercentages?.attentionControl || 0}%` }}
              ></div>
            </div>
            <div className="breakdown-value">
              {rawPercentages?.attentionControl || 0}%
            </div>
          </div>
        </div>
      </div>
    );
  };

  // Render attention improvement section
  const renderAttentionImprovement = () => {
    const { attentionImprovement } = stats;

    if (!attentionImprovement) {
      return (
        <div className="improvement-container">
          <InfoIcon text="Shows how your focus performance has changed compared to the previous period. This section will be populated once you have enough data." />
          <h3>Attention Improvement</h3>
          <p className="no-data-message">
            Complete more focus sessions to see improvement data.
          </p>
        </div>
      );
    }

    return (
      <div className="improvement-container">
        <InfoIcon text="Compares your focus metrics from the last 7 days against the previous 7 days. Shows trends in your attention losses per session and average focus duration." />
        <h3>Attention Improvement</h3>
        <p className="improvement-period">Last 7 days vs previous 7 days</p>

        <div className="improvement-metrics">
          <div className="improvement-metric">
            <div className="metric-header">
              <div className="metric-icon">👀</div>
              <div className="metric-title">Attention Losses</div>
            </div>

            <div className="metric-values">
              <div className="metric-previous">
                {attentionImprovement.attentionLosses.previous.toFixed(2)} per
                session
              </div>
              <div className="metric-arrow">
                {attentionImprovement.attentionLosses.improved ? "↓" : "↑"}
              </div>
              <div className="metric-current">
                {attentionImprovement.attentionLosses.current.toFixed(2)} per
                session
              </div>
            </div>

            <div
              className={`metric-change ${
                attentionImprovement.attentionLosses.improved
                  ? "improved"
                  : "declined"
              }`}
            >
              {attentionImprovement.attentionLosses.improved
                ? "Improved"
                : "Declined"}{" "}
              by{" "}
              {Math.abs(
                attentionImprovement.attentionLosses.percentImprovement
              ).toFixed(1)}
              %
            </div>
          </div>

          <div className="improvement-metric">
            <div className="metric-header">
              <div className="metric-icon">⏱️</div>
              <div className="metric-title">Focus Duration</div>
            </div>

            <div className="metric-values">
              <div className="metric-previous">
                {formatTime(
                  Math.round(attentionImprovement.focusDuration.previous)
                )}
              </div>
              <div className="metric-arrow">
                {attentionImprovement.focusDuration.improved ? "↑" : "↓"}
              </div>
              <div className="metric-current">
                {formatTime(
                  Math.round(attentionImprovement.focusDuration.current)
                )}
              </div>
            </div>

            <div
              className={`metric-change ${
                attentionImprovement.focusDuration.improved
                  ? "improved"
                  : "declined"
              }`}
            >
              {attentionImprovement.focusDuration.improved
                ? "Improved"
                : "Declined"}{" "}
              by{" "}
              {Math.abs(
                attentionImprovement.focusDuration.percentImprovement
              ).toFixed(1)}
              %
            </div>
          </div>
        </div>

        <div className="improvement-summary">
          <div
            className={`summary-icon ${
              attentionImprovement.overallImproved ? "positive" : "negative"
            }`}
          >
            {attentionImprovement.overallImproved ? "👍" : "👎"}
          </div>
          <div className="summary-text">
            {attentionImprovement.overallImproved
              ? "Your focus is improving! Keep up the good work."
              : "Your focus has declined. Try to minimize distractions."}
          </div>
        </div>
      </div>
    );
  };

  if (!currentUser) {
    return (
      <div className="stats-container">
        <div className="stats-header">
          <h1>Focus Statistics</h1>
        </div>
        <div className="auth-required">
          <p>Please sign in to view your statistics.</p>
          <a href="/sign-in" className="auth-button">
            Sign In
          </a>
        </div>
      </div>
    );
  }

  return (
    <div className="stats-container">
      <div className="stats-header">
        <h1>Focus Statistics</h1>
      </div>

      <div className="time-filter">
        <button
          className={timeRange === "today" ? "active" : ""}
          onClick={() => setTimeRange("today")}
          disabled={isLoading}
        >
          Today
        </button>
        <button
          className={timeRange === "week" ? "active" : ""}
          onClick={() => setTimeRange("week")}
          disabled={isLoading}
        >
          This Week
        </button>
        <button
          className={timeRange === "month" ? "active" : ""}
          onClick={() => setTimeRange("month")}
          disabled={isLoading}
        >
          This Month
        </button>
        <button
          className={timeRange === "all" ? "active" : ""}
          onClick={() => setTimeRange("all")}
          disabled={isLoading}
        >
          All Time
        </button>
      </div>

      {isLoading ? (
        <div className="loading-indicator">
          <p>Loading your statistics...</p>
        </div>
      ) : error ? (
        <div className="error-message">
          <p>{error}</p>
          <button
            className="reload-button"
            onClick={() => setTimeRange(timeRange)}
          >
            Try Again
          </button>
        </div>
      ) : stats.totalSessions === 0 ? (
        <div className="no-data-message">
          <p>You haven't completed any focus sessions yet.</p>
          <p>Complete a focus session to start seeing your statistics here.</p>
        </div>
      ) : (
        <>
          <div className="stat-cards">
            <div className="stat-card">
              <InfoIcon text="The total number of focus sessions you have completed successfully in the selected time period." />
              <div className="stat-icon">🎯</div>
              <div className="stat-value">{stats.totalSessions}</div>
              <div className="stat-label">Focus Sessions Completed</div>
            </div>

            <div className="stat-card">
              <InfoIcon text="The number of times you lost attention (looked away) during your focus sessions in the selected time period." />
              <div className="stat-icon">👀</div>
              <div className="stat-value">{stats.totalAttentionLosses}</div>
              <div className="stat-label">Times Attention Was Lost</div>
            </div>

            <div className="stat-card">
              <InfoIcon text="The average time you remained focused before looking away during your sessions. Higher values indicate better sustained attention." />
              <div className="stat-icon">⏱️</div>
              <div className="stat-value">
                {formatTime(stats.averageFocusDuration)}
              </div>
              <div className="stat-label">
                Avg. Focus Time Before Looking Away
              </div>
            </div>
          </div>

          <div className="advanced-stats">
            {/* Calendar/Streak Card */}
            {renderCalendar()}

            {/* Focus Quality Score */}
            {renderFocusQualityMeter()}
          </div>

          {/* Attention Improvement */}
          {renderAttentionImprovement()}

          <div className="stats-actions">
            <button
              className="reset-stats"
              onClick={handleResetStats}
              disabled={isLoading}
            >
              Reset Statistics
            </button>
          </div>
        </>
      )}
    </div>
  );
};

export default Stats;
