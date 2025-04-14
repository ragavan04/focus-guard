import React, { useState, useEffect, useContext } from "react";
import { UserContext } from "../../contexts/user.context";
import {
  getFriends,
  getFriendRequests,
  sendFriendRequest,
  respondToFriendRequest,
  removeFriend,
} from "../../utils/firebase.utils";
import statsService from "../../services/statsService";
import "../../styles/Friends.css";

const Friends = () => {
  const { currentUser } = useContext(UserContext);
  const [activeTab, setActiveTab] = useState("list");
  const [friends, setFriends] = useState([]);
  const [friendRequests, setFriendRequests] = useState({
    received: [],
    sent: [],
  });
  const [newFriendEmail, setNewFriendEmail] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  const [notification, setNotification] = useState(null);
  const [selectedFriend, setSelectedFriend] = useState(null);
  const [friendStats, setFriendStats] = useState(null);
  const [timeRange, setTimeRange] = useState("all");
  const [leaderboardMetric, setLeaderboardMetric] = useState("focus-quality");
  const [leaderboardData, setLeaderboardData] = useState([]);
  const [leaderboardLoading, setLeaderboardLoading] = useState(false);

  // Load friends and friend requests
  useEffect(() => {
    const loadFriendsData = async () => {
      if (!currentUser) {
        setIsLoading(false);
        return;
      }

      setIsLoading(true);
      setError(null);

      try {
        // Load friends list
        const friendsList = await getFriends();
        setFriends(friendsList);

        // Load friend requests
        const requests = await getFriendRequests();
        setFriendRequests(requests);
      } catch (error) {
        console.error("Error loading friends data:", error);
        setError("Failed to load friends data. Please try again.");
      } finally {
        setIsLoading(false);
      }
    };

    loadFriendsData();
  }, [currentUser]);

  // Load friend stats when a friend is selected
  useEffect(() => {
    const loadFriendStats = async () => {
      if (!selectedFriend) {
        setFriendStats(null);
        return;
      }

      try {
        const stats = await statsService.getFriendStats(
          selectedFriend.id,
          timeRange
        );
        setFriendStats(stats);
      } catch (error) {
        console.error("Error loading friend stats:", error);
        setError("Failed to load friend statistics.");
      }
    };

    loadFriendStats();
  }, [selectedFriend, timeRange]);

  // Load leaderboard data when the leaderboard tab is active
  useEffect(() => {
    const loadLeaderboardData = async () => {
      if (activeTab !== "leaderboard" || !currentUser) return;

      setLeaderboardLoading(true);
      setError(null);

      try {
        // Get current user's stats
        const userStats = await statsService.getStatsByTimeRange(timeRange);

        // Add current user to leaderboard
        const leaderboard = [
          {
            id: currentUser.uid,
            displayName: currentUser.displayName || "You",
            email: currentUser.email,
            photoURL: currentUser.photoURL,
            isCurrentUser: true,
            stats: userStats,
          },
        ];

        // Get stats for each friend
        const friendsWithStats = await Promise.all(
          friends.map(async (friend) => {
            try {
              const stats = await statsService.getFriendStats(
                friend.id,
                timeRange
              );
              return {
                ...friend,
                isCurrentUser: false,
                stats,
              };
            } catch (error) {
              console.error(
                `Error fetching stats for friend ${friend.id}:`,
                error
              );
              return {
                ...friend,
                isCurrentUser: false,
                stats: null,
              };
            }
          })
        );

        // Add friends with valid stats to leaderboard
        friendsWithStats.forEach((friend) => {
          if (friend.stats) {
            leaderboard.push(friend);
          }
        });

        // Sort leaderboard based on selected metric
        const sortedLeaderboard = sortLeaderboard(
          leaderboard,
          leaderboardMetric
        );
        setLeaderboardData(sortedLeaderboard);
      } catch (error) {
        console.error("Error loading leaderboard data:", error);
        setError("Failed to load leaderboard data.");
      } finally {
        setLeaderboardLoading(false);
      }
    };

    loadLeaderboardData();
  }, [activeTab, timeRange, leaderboardMetric, friends, currentUser]);

  // Sort leaderboard based on selected metric
  const sortLeaderboard = (data, metric) => {
    return [...data].sort((a, b) => {
      if (!a.stats || !b.stats) return 0;

      switch (metric) {
        case "focus-quality":
          return (
            (b.stats.focusQuality?.score || 0) -
            (a.stats.focusQuality?.score || 0)
          );
        case "focus-sessions":
          return (b.stats.totalSessions || 0) - (a.stats.totalSessions || 0);
        case "fewest-losses":
          if (a.stats.totalSessions === 0 && b.stats.totalSessions === 0)
            return 0;
          // If sessions are 0, put them at the bottom
          if (a.stats.totalSessions === 0) return 1;
          if (b.stats.totalSessions === 0) return -1;

          // For users with sessions, calculate losses per session ratio
          const aRatio = a.stats.totalAttentionLosses / a.stats.totalSessions;
          const bRatio = b.stats.totalAttentionLosses / b.stats.totalSessions;
          return aRatio - bRatio; // Lower is better
        case "streak":
          return (
            (b.stats.streak?.currentStreak || 0) -
            (a.stats.streak?.currentStreak || 0)
          );
        default:
          return 0;
      }
    });
  };

  // Handle sending friend request
  const handleSendRequest = async (e) => {
    e.preventDefault();
    if (!newFriendEmail.trim()) return;

    setIsLoading(true);
    setError(null);

    try {
      await sendFriendRequest(newFriendEmail.trim());

      // Refresh friend requests
      const requests = await getFriendRequests();
      setFriendRequests(requests);

      // Show notification
      setNotification({
        message: `Friend request sent to ${newFriendEmail}`,
        type: "success",
      });

      // Clear the input
      setNewFriendEmail("");
    } catch (error) {
      console.error("Error sending friend request:", error);
      setError(error.message || "Failed to send friend request.");
    } finally {
      setIsLoading(false);
    }
  };

  // Handle responding to friend request
  const handleRespondToRequest = async (requestId, accept) => {
    setIsLoading(true);
    setError(null);

    try {
      await respondToFriendRequest(requestId, accept);

      // Refresh both friend requests and friends list
      const requests = await getFriendRequests();
      setFriendRequests(requests);

      const friendsList = await getFriends();
      setFriends(friendsList);

      // Show notification
      setNotification({
        message: accept ? "Friend request accepted" : "Friend request rejected",
        type: "success",
      });
    } catch (error) {
      console.error("Error responding to friend request:", error);
      setError(error.message || "Failed to respond to friend request.");
    } finally {
      setIsLoading(false);
    }
  };

  // Handle removing a friend
  const handleRemoveFriend = async (friendId) => {
    if (!window.confirm("Are you sure you want to remove this friend?")) {
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      await removeFriend(friendId);

      // Refresh friends list
      const friendsList = await getFriends();
      setFriends(friendsList);

      // Clear selected friend if they were removed
      if (selectedFriend && selectedFriend.id === friendId) {
        setSelectedFriend(null);
      }

      // Show notification
      setNotification({
        message: "Friend removed successfully",
        type: "success",
      });
    } catch (error) {
      console.error("Error removing friend:", error);
      setError(error.message || "Failed to remove friend.");
    } finally {
      setIsLoading(false);
    }
  };

  // Format time for display (same as in Stats component)
  const formatTime = (seconds) => {
    if (seconds === null || seconds === undefined) return "0:00";
    // Convert to number in case it's a string
    const secondsNum = Number(seconds);
    const mins = Math.floor(secondsNum / 60);
    const secs = Math.floor(secondsNum % 60);
    return `${mins}:${secs < 10 ? "0" + secs : secs}`;
  };

  // Get medal emoji based on rank
  const getMedalEmoji = (rank) => {
    switch (rank) {
      case 0:
        return "🥇";
      case 1:
        return "🥈";
      case 2:
        return "🥉";
      default:
        return `${rank + 1}.`;
    }
  };

  // Render notification
  const renderNotification = () => {
    if (!notification) return null;

    return (
      <div className={`notification ${notification.type}`}>
        <p>{notification.message}</p>
        <button onClick={() => setNotification(null)}>×</button>
      </div>
    );
  };

  // Render friend list tab
  const renderFriendList = () => {
    if (friends.length === 0) {
      return (
        <div className="empty-state">
          <p>You haven't added any friends yet.</p>
          <button
            onClick={() => setActiveTab("add")}
            className="primary-button"
          >
            Add Friends
          </button>
        </div>
      );
    }

    return (
      <div className="friends-container">
        <div className="friends-list">
          <h3>Your Friends</h3>
          <ul>
            {friends.map((friend) => (
              <li
                key={friend.id}
                className={selectedFriend?.id === friend.id ? "selected" : ""}
                onClick={() => setSelectedFriend(friend)}
              >
                <div className="friend-avatar">
                  {friend.photoURL ? (
                    <img
                      src={friend.photoURL}
                      alt={`${friend.displayName}'s avatar`}
                    />
                  ) : (
                    <div className="avatar-placeholder">
                      {friend.displayName.charAt(0).toUpperCase()}
                    </div>
                  )}
                </div>
                <div className="friend-info">
                  <p className="friend-name">{friend.displayName}</p>
                  <p className="friend-email">{friend.email}</p>
                </div>
                <button
                  className="remove-friend-button"
                  onClick={(e) => {
                    e.stopPropagation();
                    handleRemoveFriend(friend.id);
                  }}
                >
                  Remove
                </button>
              </li>
            ))}
          </ul>
        </div>

        <div className="friend-stats-container">
          {selectedFriend ? (
            <>
              <h3>{selectedFriend.displayName}'s Focus Stats</h3>

              <div className="time-range-selector">
                <button
                  className={timeRange === "all" ? "active" : ""}
                  onClick={() => setTimeRange("all")}
                >
                  All Time
                </button>
                <button
                  className={timeRange === "today" ? "active" : ""}
                  onClick={() => setTimeRange("today")}
                >
                  Today
                </button>
                <button
                  className={timeRange === "week" ? "active" : ""}
                  onClick={() => setTimeRange("week")}
                >
                  This Week
                </button>
                <button
                  className={timeRange === "month" ? "active" : ""}
                  onClick={() => setTimeRange("month")}
                >
                  This Month
                </button>
              </div>

              {friendStats ? (
                <div className="stats-overview">
                  <div className="stats-card">
                    <h4>Focus Sessions</h4>
                    <p className="stats-value">{friendStats.totalSessions}</p>
                  </div>

                  <div className="stats-card">
                    <h4>Attention Losses</h4>
                    <p className="stats-value">
                      {friendStats.totalAttentionLosses}
                    </p>
                  </div>

                  <div className="stats-card">
                    <h4>Avg Focus Duration</h4>
                    <p className="stats-value">
                      {formatTime(friendStats.averageFocusDuration)}
                    </p>
                  </div>

                  <div className="stats-card">
                    <h4>Current Streak</h4>
                    <p className="stats-value">
                      {friendStats.streak.currentStreak} day
                      {friendStats.streak.currentStreak !== 1 ? "s" : ""}
                    </p>
                  </div>
                </div>
              ) : (
                <p>Loading stats...</p>
              )}
            </>
          ) : (
            <div className="empty-state">
              <p>Select a friend to view their stats</p>
            </div>
          )}
        </div>
      </div>
    );
  };

  // Render leaderboard tab
  const renderLeaderboard = () => {
    return (
      <div className="leaderboard-container">
        <h3>Focus Stats Leaderboard</h3>

        <div className="leaderboard-filters">
          <div className="time-range-selector">
            <button
              className={timeRange === "all" ? "active" : ""}
              onClick={() => setTimeRange("all")}
            >
              All Time
            </button>
            <button
              className={timeRange === "today" ? "active" : ""}
              onClick={() => setTimeRange("today")}
            >
              Today
            </button>
            <button
              className={timeRange === "week" ? "active" : ""}
              onClick={() => setTimeRange("week")}
            >
              This Week
            </button>
            <button
              className={timeRange === "month" ? "active" : ""}
              onClick={() => setTimeRange("month")}
            >
              This Month
            </button>
          </div>

          <div className="metric-selector">
            <button
              className={leaderboardMetric === "focus-quality" ? "active" : ""}
              onClick={() => setLeaderboardMetric("focus-quality")}
            >
              Focus Quality
            </button>
            <button
              className={leaderboardMetric === "focus-sessions" ? "active" : ""}
              onClick={() => setLeaderboardMetric("focus-sessions")}
            >
              Focus Sessions
            </button>
            <button
              className={leaderboardMetric === "fewest-losses" ? "active" : ""}
              onClick={() => setLeaderboardMetric("fewest-losses")}
            >
              Fewest Distractions
            </button>
            <button
              className={leaderboardMetric === "streak" ? "active" : ""}
              onClick={() => setLeaderboardMetric("streak")}
            >
              Longest Streak
            </button>
          </div>
        </div>

        {leaderboardLoading ? (
          <div className="loading">Loading leaderboard data...</div>
        ) : leaderboardData.length === 0 ? (
          <div className="empty-state">
            <p>No leaderboard data available for the selected time range.</p>
          </div>
        ) : (
          <div className="leaderboard-table">
            <table>
              <thead>
                <tr>
                  <th>Rank</th>
                  <th>User</th>
                  {leaderboardMetric === "focus-quality" && (
                    <th>Focus Quality</th>
                  )}
                  {leaderboardMetric === "focus-sessions" && (
                    <th>Focus Sessions</th>
                  )}
                  {leaderboardMetric === "fewest-losses" && (
                    <th>Distractions per Session</th>
                  )}
                  {leaderboardMetric === "streak" && <th>Current Streak</th>}
                </tr>
              </thead>
              <tbody>
                {leaderboardData.map((user, index) => (
                  <tr
                    key={user.id}
                    className={user.isCurrentUser ? "current-user" : ""}
                  >
                    <td className="rank">{getMedalEmoji(index)}</td>
                    <td className="user-info">
                      <div className="friend-avatar small">
                        {user.photoURL ? (
                          <img
                            src={user.photoURL}
                            alt={`${user.displayName}'s avatar`}
                          />
                        ) : (
                          <div className="avatar-placeholder small">
                            {user.displayName.charAt(0).toUpperCase()}
                          </div>
                        )}
                      </div>
                      <div>
                        <span className="user-name">
                          {user.displayName}
                          {user.isCurrentUser ? " (You)" : ""}
                        </span>
                      </div>
                    </td>
                    {leaderboardMetric === "focus-quality" && (
                      <td className="metric-value">
                        {user.stats.focusQuality?.score || 0}%
                      </td>
                    )}
                    {leaderboardMetric === "focus-sessions" && (
                      <td className="metric-value">
                        {user.stats.totalSessions}
                      </td>
                    )}
                    {leaderboardMetric === "fewest-losses" && (
                      <td className="metric-value">
                        {user.stats.totalSessions > 0
                          ? (
                              user.stats.totalAttentionLosses /
                              user.stats.totalSessions
                            ).toFixed(1)
                          : "N/A"}
                      </td>
                    )}
                    {leaderboardMetric === "streak" && (
                      <td className="metric-value">
                        {user.stats.streak?.currentStreak || 0} day
                        {user.stats.streak?.currentStreak !== 1 ? "s" : ""}
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    );
  };

  // Render friend request inbox tab
  const renderFriendRequests = () => {
    const { received, sent } = friendRequests;

    if (received.length === 0 && sent.length === 0) {
      return (
        <div className="empty-state">
          <p>No pending friend requests</p>
          <button
            onClick={() => setActiveTab("add")}
            className="primary-button"
          >
            Send Friend Request
          </button>
        </div>
      );
    }

    return (
      <div className="requests-container">
        {received.length > 0 && (
          <div className="received-requests">
            <h3>Received Requests</h3>
            <ul>
              {received.map((request) => (
                <li key={request.id}>
                  <div className="request-info">
                    <p className="sender-name">
                      {request.senderName || request.senderEmail}
                    </p>
                    <p className="sender-email">{request.senderEmail}</p>
                  </div>
                  <div className="request-actions">
                    <button
                      className="accept-button"
                      onClick={() => handleRespondToRequest(request.id, true)}
                    >
                      Accept
                    </button>
                    <button
                      className="reject-button"
                      onClick={() => handleRespondToRequest(request.id, false)}
                    >
                      Reject
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          </div>
        )}

        {sent.length > 0 && (
          <div className="sent-requests">
            <h3>Sent Requests</h3>
            <ul>
              {sent.map((request) => (
                <li key={request.id}>
                  <div className="request-info">
                    <p className="recipient-email">{request.recipientEmail}</p>
                    <p className="request-status">Pending</p>
                  </div>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    );
  };

  // Render add friend tab
  const renderAddFriend = () => {
    return (
      <div className="add-friend-container">
        <h3>Add Friend</h3>
        <p>Enter your friend's email address to send them a friend request.</p>

        <form onSubmit={handleSendRequest}>
          <div className="form-group">
            <label htmlFor="friendEmail">Friend's Email:</label>
            <input
              type="email"
              id="friendEmail"
              value={newFriendEmail}
              onChange={(e) => setNewFriendEmail(e.target.value)}
              placeholder="Enter email address"
              required
            />
          </div>
          <button
            type="submit"
            className="primary-button"
            disabled={isLoading || !newFriendEmail.trim()}
          >
            {isLoading ? "Sending..." : "Send Friend Request"}
          </button>
        </form>
      </div>
    );
  };

  if (!currentUser) {
    return (
      <div className="friends-page not-logged-in">
        <h2>Friends</h2>
        <p>Please sign in to view and manage your friends.</p>
      </div>
    );
  }

  return (
    <div className="friends-page">
      <h2>Friends</h2>

      {renderNotification()}

      {error && <div className="error-message">{error}</div>}

      <div className="tabs">
        <button
          className={activeTab === "list" ? "active" : ""}
          onClick={() => setActiveTab("list")}
        >
          Friend List
        </button>
        <button
          className={activeTab === "leaderboard" ? "active" : ""}
          onClick={() => setActiveTab("leaderboard")}
        >
          Leaderboard
        </button>
        <button
          className={activeTab === "inbox" ? "active" : ""}
          onClick={() => setActiveTab("inbox")}
        >
          Inbox{" "}
          {friendRequests.received.length > 0 && (
            <span className="badge">{friendRequests.received.length}</span>
          )}
        </button>
        <button
          className={activeTab === "add" ? "active" : ""}
          onClick={() => setActiveTab("add")}
        >
          Add Friend
        </button>
      </div>

      <div className="tab-content">
        {isLoading && !error ? (
          <div className="loading">Loading...</div>
        ) : (
          <>
            {activeTab === "list" && renderFriendList()}
            {activeTab === "leaderboard" && renderLeaderboard()}
            {activeTab === "inbox" && renderFriendRequests()}
            {activeTab === "add" && renderAddFriend()}
          </>
        )}
      </div>
    </div>
  );
};

export default Friends;
