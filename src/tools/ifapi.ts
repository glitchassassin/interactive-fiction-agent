interface GameResponse {
  text: string;
}

interface SessionResponse {
  sessionId: string;
  output: string;
}

interface CommandResponse {
  output: string;
}

// Define the API endpoint for the interactive fiction game
const IF_GAME_API_URL = process.env.IF_GAME_API_URL || "http://localhost:3000";

/**
 * Starts a new interactive fiction game session
 * @param gameName The name of the game to start
 * @returns The initial game text and session ID
 */
export async function startGame(
  gameName: string
): Promise<{ text: string; sessionId: string }> {
  try {
    const response = await fetch(`${IF_GAME_API_URL}/sessions/`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ gameName }),
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const data = (await response.json()) as SessionResponse;

    return {
      text: data.output,
      sessionId: data.sessionId,
    };
  } catch (error) {
    console.error("Error starting game:", error);
    return {
      text: `Error: Failed to start game "${gameName}". Please try again.`,
      sessionId: "",
    };
  }
}

/**
 * Sends a command to the interactive fiction game API
 * @param command The command to send
 * @returns The game's response
 */
export async function sendCommand(
  sessionId: string,
  command: string
): Promise<GameResponse> {
  try {
    const response = await fetch(
      `${IF_GAME_API_URL}/sessions/${sessionId}/command`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ command }),
      }
    );

    if (!response.ok) {
      if (response.status === 404) {
        throw new Error(
          "Game session not found. The session may have expired. Please start a new game."
        );
      }
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const data = (await response.json()) as CommandResponse;

    return {
      text: data.output,
    };
  } catch (error) {
    console.error("Error sending command to game:", error);
    return {
      text: `Error: Failed to send command "${command}" to the game. Please try again.`,
    };
  }
}
