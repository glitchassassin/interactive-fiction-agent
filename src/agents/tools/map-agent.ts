import { z } from "zod";
import { BaseAgent, BaseAgentConfig, Tool } from "../base.js";
import { generateText } from "ai";

/**
 * Interface for a location in the game world
 */
export interface Location {
  id: string;
  name: string;
  description: string;
  exits: {
    direction: string;
    destinationId?: string;
    description?: string;
    blocked?: boolean;
    blockReason?: string;
  }[];
  items: {
    name: string;
    description?: string;
    takeable?: boolean;
    taken?: boolean;
  }[];
  visited: boolean;
  notes: string[];
  createdAt: number;
  lastVisitedAt?: number;
}

/**
 * Configuration options for the MapAgent
 */
export interface MapAgentConfig extends BaseAgentConfig {
  /**
   * Maximum number of locations to store
   * @default 100
   */
  maxLocations?: number;
}

/**
 * Agent that manages a map of the game world
 */
export class MapAgent extends BaseAgent {
  private locations: Map<string, Location> = new Map();
  private readonly maxLocations: number;
  private locationCounter: number = 0;
  private currentLocationId?: string;

  constructor({ maxLocations = 100, ...config }: MapAgentConfig) {
    // Create map management tools
    const addLocationTool: Tool = {
      name: "add_location",
      description: "Add a new location to the map",
      parameters: z.object({
        name: z.string().describe("Name of the location"),
        description: z.string().describe("Description of the location"),
        exits: z
          .array(
            z.object({
              direction: z
                .string()
                .describe(
                  "Direction of the exit (e.g., north, south, east, west)"
                ),
              destinationId: z
                .string()
                .optional()
                .describe("ID of the destination location, if known"),
              description: z
                .string()
                .optional()
                .describe("Description of the exit"),
              blocked: z
                .boolean()
                .optional()
                .describe("Whether the exit is blocked"),
              blockReason: z
                .string()
                .optional()
                .describe("Reason the exit is blocked"),
            })
          )
          .optional()
          .describe("Exits from this location"),
        items: z
          .array(
            z.object({
              name: z.string().describe("Name of the item"),
              description: z
                .string()
                .optional()
                .describe("Description of the item"),
              takeable: z
                .boolean()
                .optional()
                .describe("Whether the item can be taken"),
            })
          )
          .optional()
          .describe("Items at this location"),
        notes: z
          .array(z.string())
          .optional()
          .describe("Notes about this location"),
      }),
      execute: async (params) => {
        return this.addLocation(
          params.name,
          params.description,
          params.exits || [],
          params.items || [],
          params.notes || []
        );
      },
    };

    const updateLocationTool: Tool = {
      name: "update_location",
      description: "Update an existing location",
      parameters: z.object({
        locationId: z.string().describe("ID of the location to update"),
        name: z.string().optional().describe("Updated name of the location"),
        description: z
          .string()
          .optional()
          .describe("Updated description of the location"),
        notes: z
          .array(z.string())
          .optional()
          .describe("Additional notes about this location"),
      }),
      execute: async (params) => {
        return this.updateLocation(
          params.locationId,
          params.name,
          params.description,
          params.notes
        );
      },
    };

    const addExitTool: Tool = {
      name: "add_exit",
      description: "Add an exit to a location",
      parameters: z.object({
        locationId: z.string().describe("ID of the location"),
        direction: z
          .string()
          .describe("Direction of the exit (e.g., north, south, east, west)"),
        destinationId: z
          .string()
          .optional()
          .describe("ID of the destination location, if known"),
        description: z.string().optional().describe("Description of the exit"),
        blocked: z.boolean().optional().describe("Whether the exit is blocked"),
        blockReason: z
          .string()
          .optional()
          .describe("Reason the exit is blocked"),
      }),
      execute: async (params) => {
        return this.addExit(
          params.locationId,
          params.direction,
          params.destinationId,
          params.description,
          params.blocked,
          params.blockReason
        );
      },
    };

    const updateExitTool: Tool = {
      name: "update_exit",
      description: "Update an exit from a location",
      parameters: z.object({
        locationId: z.string().describe("ID of the location"),
        direction: z.string().describe("Direction of the exit to update"),
        destinationId: z.string().optional().describe("Updated destination ID"),
        description: z.string().optional().describe("Updated description"),
        blocked: z.boolean().optional().describe("Whether the exit is blocked"),
        blockReason: z
          .string()
          .optional()
          .describe("Reason the exit is blocked"),
      }),
      execute: async (params) => {
        return this.updateExit(
          params.locationId,
          params.direction,
          params.destinationId,
          params.description,
          params.blocked,
          params.blockReason
        );
      },
    };

    const addItemTool: Tool = {
      name: "add_item",
      description: "Add an item to a location",
      parameters: z.object({
        locationId: z.string().describe("ID of the location"),
        name: z.string().describe("Name of the item"),
        description: z.string().optional().describe("Description of the item"),
        takeable: z
          .boolean()
          .optional()
          .describe("Whether the item can be taken"),
      }),
      execute: async (params) => {
        return this.addItem(
          params.locationId,
          params.name,
          params.description,
          params.takeable
        );
      },
    };

    const removeItemTool: Tool = {
      name: "remove_item",
      description: "Remove an item from a location (e.g., when taken)",
      parameters: z.object({
        locationId: z.string().describe("ID of the location"),
        itemName: z.string().describe("Name of the item to remove"),
        taken: z
          .boolean()
          .optional()
          .describe("Whether the item was taken by the player"),
      }),
      execute: async (params) => {
        return this.removeItem(
          params.locationId,
          params.itemName,
          params.taken
        );
      },
    };

    const setCurrentLocationTool: Tool = {
      name: "set_current_location",
      description: "Set the current location of the player",
      parameters: z.object({
        locationId: z.string().describe("ID of the current location"),
      }),
      execute: async (params) => {
        return this.setCurrentLocation(params.locationId);
      },
    };

    const getLocationTool: Tool = {
      name: "get_location",
      description: "Get details about a specific location",
      parameters: z.object({
        locationId: z.string().describe("ID of the location"),
      }),
      execute: async (params) => {
        return this.getLocation(params.locationId);
      },
    };

    const getCurrentLocationTool: Tool = {
      name: "get_current_location",
      description: "Get the current location of the player",
      parameters: z.object({}),
      execute: async () => {
        return this.getCurrentLocation();
      },
    };

    const findPathTool: Tool = {
      name: "find_path",
      description: "Find a path between two locations",
      parameters: z.object({
        fromLocationId: z.string().describe("ID of the starting location"),
        toLocationId: z.string().describe("ID of the destination location"),
      }),
      execute: async (params) => {
        return this.findPath(params.fromLocationId, params.toLocationId);
      },
    };

    const generateMapTool: Tool = {
      name: "generate_map",
      description: "Generate a text representation of the map",
      parameters: z.object({}),
      execute: async () => {
        return this.generateMap();
      },
    };

    // Create the system prompt for the map agent
    const systemPrompt =
      config.systemPrompt ||
      `
You are a mapping agent that helps track locations in an interactive fiction game.
Your role is to:
1. Create and update locations in the game world
2. Track connections between locations
3. Record items found at each location
4. Help navigate between locations

Be detailed in your mapping and help the player understand the game world.
`;

    // Call the base constructor with the tools
    super({
      ...config,
      tools: [
        addLocationTool,
        updateLocationTool,
        addExitTool,
        updateExitTool,
        addItemTool,
        removeItemTool,
        setCurrentLocationTool,
        getLocationTool,
        getCurrentLocationTool,
        findPathTool,
        generateMapTool,
        ...(config.tools || []),
      ],
      systemPrompt,
    });

    this.maxLocations = maxLocations;
  }

  /**
   * Add a new location
   */
  private addLocation(
    name: string,
    description: string,
    exits: {
      direction: string;
      destinationId?: string;
      description?: string;
      blocked?: boolean;
      blockReason?: string;
    }[] = [],
    items: {
      name: string;
      description?: string;
      takeable?: boolean;
    }[] = [],
    notes: string[] = []
  ): Location {
    const id = `loc_${++this.locationCounter}`;
    const createdAt = Date.now();

    const newLocation: Location = {
      id,
      name,
      description,
      exits: [...exits],
      items: items.map((item) => ({
        ...item,
        taken: false,
      })),
      visited: false,
      notes: [...notes],
      createdAt,
    };

    this.locations.set(id, newLocation);
    this.logger.info(`Added location: ${name}`);

    // If we exceed the maximum number of locations, remove the oldest ones
    if (this.locations.size > this.maxLocations) {
      const locationEntries = Array.from(this.locations.entries());
      locationEntries.sort((a, b) => a[1].createdAt - b[1].createdAt);

      for (let i = 0; i < locationEntries.length - this.maxLocations; i++) {
        this.locations.delete(locationEntries[i][0]);
        this.logger.info(`Removed old location: ${locationEntries[i][1].name}`);
      }
    }

    return newLocation;
  }

  /**
   * Update an existing location
   */
  private updateLocation(
    locationId: string,
    name?: string,
    description?: string,
    notes?: string[]
  ): Location | null {
    const location = this.locations.get(locationId);

    if (!location) {
      this.logger.warn(`Location with ID ${locationId} not found`);
      return null;
    }

    if (name !== undefined) {
      location.name = name;
    }

    if (description !== undefined) {
      location.description = description;
    }

    if (notes !== undefined && notes.length > 0) {
      location.notes = [...location.notes, ...notes];
    }

    this.logger.info(`Updated location: ${location.name}`);

    return location;
  }

  /**
   * Add an exit to a location
   */
  private addExit(
    locationId: string,
    direction: string,
    destinationId?: string,
    description?: string,
    blocked?: boolean,
    blockReason?: string
  ): Location | null {
    const location = this.locations.get(locationId);

    if (!location) {
      this.logger.warn(`Location with ID ${locationId} not found`);
      return null;
    }

    // Check if the exit already exists
    const existingExitIndex = location.exits.findIndex(
      (exit) => exit.direction.toLowerCase() === direction.toLowerCase()
    );

    if (existingExitIndex !== -1) {
      // Update the existing exit
      location.exits[existingExitIndex] = {
        ...location.exits[existingExitIndex],
        direction,
        destinationId,
        description,
        blocked,
        blockReason,
      };
      this.logger.info(`Updated exit ${direction} from ${location.name}`);
    } else {
      // Add a new exit
      location.exits.push({
        direction,
        destinationId,
        description,
        blocked,
        blockReason,
      });
      this.logger.info(`Added exit ${direction} from ${location.name}`);
    }

    return location;
  }

  /**
   * Update an exit from a location
   */
  private updateExit(
    locationId: string,
    direction: string,
    destinationId?: string,
    description?: string,
    blocked?: boolean,
    blockReason?: string
  ): Location | null {
    const location = this.locations.get(locationId);

    if (!location) {
      this.logger.warn(`Location with ID ${locationId} not found`);
      return null;
    }

    // Find the exit
    const exitIndex = location.exits.findIndex(
      (exit) => exit.direction.toLowerCase() === direction.toLowerCase()
    );

    if (exitIndex === -1) {
      this.logger.warn(`Exit ${direction} not found in location ${locationId}`);
      return null;
    }

    // Update the exit
    if (destinationId !== undefined) {
      location.exits[exitIndex].destinationId = destinationId;
    }

    if (description !== undefined) {
      location.exits[exitIndex].description = description;
    }

    if (blocked !== undefined) {
      location.exits[exitIndex].blocked = blocked;
    }

    if (blockReason !== undefined) {
      location.exits[exitIndex].blockReason = blockReason;
    }

    this.logger.info(`Updated exit ${direction} from ${location.name}`);

    return location;
  }

  /**
   * Add an item to a location
   */
  private addItem(
    locationId: string,
    name: string,
    description?: string,
    takeable?: boolean
  ): Location | null {
    const location = this.locations.get(locationId);

    if (!location) {
      this.logger.warn(`Location with ID ${locationId} not found`);
      return null;
    }

    // Check if the item already exists
    const existingItemIndex = location.items.findIndex(
      (item) => item.name.toLowerCase() === name.toLowerCase() && !item.taken
    );

    if (existingItemIndex !== -1) {
      // Update the existing item
      location.items[existingItemIndex] = {
        ...location.items[existingItemIndex],
        name,
        description,
        takeable,
      };
      this.logger.info(`Updated item ${name} at ${location.name}`);
    } else {
      // Add a new item
      location.items.push({
        name,
        description,
        takeable,
        taken: false,
      });
      this.logger.info(`Added item ${name} to ${location.name}`);
    }

    return location;
  }

  /**
   * Remove an item from a location
   */
  private removeItem(
    locationId: string,
    itemName: string,
    taken: boolean = true
  ): Location | null {
    const location = this.locations.get(locationId);

    if (!location) {
      this.logger.warn(`Location with ID ${locationId} not found`);
      return null;
    }

    // Find the item
    const itemIndex = location.items.findIndex(
      (item) =>
        item.name.toLowerCase() === itemName.toLowerCase() && !item.taken
    );

    if (itemIndex === -1) {
      this.logger.warn(`Item ${itemName} not found in location ${locationId}`);
      return null;
    }

    if (taken) {
      // Mark the item as taken
      location.items[itemIndex].taken = true;
      this.logger.info(
        `Marked item ${itemName} as taken from ${location.name}`
      );
    } else {
      // Remove the item completely
      location.items.splice(itemIndex, 1);
      this.logger.info(`Removed item ${itemName} from ${location.name}`);
    }

    return location;
  }

  /**
   * Set the current location of the player
   */
  private setCurrentLocation(locationId: string): Location | null {
    const location = this.locations.get(locationId);

    if (!location) {
      this.logger.warn(`Location with ID ${locationId} not found`);
      return null;
    }

    this.currentLocationId = locationId;

    // Mark the location as visited and update the last visited timestamp
    location.visited = true;
    location.lastVisitedAt = Date.now();

    this.logger.info(`Set current location to ${location.name}`);

    return location;
  }

  /**
   * Get details about a specific location
   */
  private getLocation(locationId: string): Location | null {
    const location = this.locations.get(locationId);

    if (!location) {
      this.logger.warn(`Location with ID ${locationId} not found`);
      return null;
    }

    return location;
  }

  /**
   * Get the current location of the player
   */
  private getCurrentLocation(): Location | null {
    if (!this.currentLocationId) {
      this.logger.warn("Current location not set");
      return null;
    }

    return this.getLocation(this.currentLocationId);
  }

  /**
   * Find a path between two locations
   */
  private async findPath(
    fromLocationId: string,
    toLocationId: string
  ): Promise<string> {
    const fromLocation = this.locations.get(fromLocationId);
    const toLocation = this.locations.get(toLocationId);

    if (!fromLocation) {
      return `Starting location with ID ${fromLocationId} not found`;
    }

    if (!toLocation) {
      return `Destination location with ID ${toLocationId} not found`;
    }

    // Use breadth-first search to find the shortest path
    const queue: {
      locationId: string;
      path: { direction: string; locationId: string }[];
    }[] = [{ locationId: fromLocationId, path: [] }];
    const visited = new Set<string>([fromLocationId]);

    while (queue.length > 0) {
      const { locationId, path } = queue.shift()!;

      if (locationId === toLocationId) {
        // Path found
        let pathDescription = `Path from "${fromLocation.name}" to "${toLocation.name}":\n\n`;

        if (path.length === 0) {
          pathDescription += "You are already at the destination.";
        } else {
          pathDescription += path
            .map((step, index) => {
              const location = this.locations.get(step.locationId);
              return `${index + 1}. Go ${step.direction} to ${
                location ? location.name : "unknown location"
              }`;
            })
            .join("\n");
        }

        return pathDescription;
      }

      const location = this.locations.get(locationId);
      if (!location) continue;

      // Add all unvisited neighbors to the queue
      for (const exit of location.exits) {
        if (
          exit.destinationId &&
          !exit.blocked &&
          !visited.has(exit.destinationId)
        ) {
          visited.add(exit.destinationId);
          queue.push({
            locationId: exit.destinationId,
            path: [
              ...path,
              { direction: exit.direction, locationId: exit.destinationId },
            ],
          });
        }
      }
    }

    // If we get here, no path was found
    // Generate a more helpful response using the LLM
    const pathAnalysisPrompt = `
I'm trying to find a path from "${fromLocation.name}" to "${
      toLocation.name
    }" in the game world, but couldn't find a direct path.

Here's what I know about the starting location:
- Name: ${fromLocation.name}
- Description: ${fromLocation.description}
- Exits: ${fromLocation.exits
      .map((e) => `${e.direction}${e.blocked ? " (blocked)" : ""}`)
      .join(", ")}

And the destination:
- Name: ${toLocation.name}
- Description: ${toLocation.description}
- Exits: ${toLocation.exits
      .map((e) => `${e.direction}${e.blocked ? " (blocked)" : ""}`)
      .join(", ")}

Please analyze the situation and suggest:
1. Why a path might not exist (e.g., missing connections, blocked paths)
2. What areas to explore to potentially find a connection
3. Any other strategies that might help reach the destination
`;

    this.dialogue.user(pathAnalysisPrompt);
    const analysis = await this.generateAnalysis(pathAnalysisPrompt);
    return `No direct path found from "${fromLocation.name}" to "${toLocation.name}".\n\n${analysis}`;
  }

  /**
   * Generate a text representation of the map
   */
  private async generateMap(): Promise<string> {
    if (this.locations.size === 0) {
      return "No locations have been mapped yet.";
    }

    // Prepare location data for the LLM
    const locationData = Array.from(this.locations.values()).map((location) => {
      const connectedLocations = location.exits
        .filter((exit) => exit.destinationId)
        .map((exit) => {
          const destination = this.locations.get(exit.destinationId!);
          return destination
            ? `${exit.direction}: ${destination.name}${
                exit.blocked ? " (blocked)" : ""
              }`
            : null;
        })
        .filter(Boolean);

      const items = location.items
        .filter((item) => !item.taken)
        .map((item) => item.name);

      return {
        name: location.name,
        visited: location.visited,
        connections: connectedLocations,
        items: items,
        isCurrent: location.id === this.currentLocationId,
      };
    });

    // Generate a map using the LLM
    const mapPrompt = `
Please create a text-based map representation of the following game world locations:

${JSON.stringify(locationData, null, 2)}

The map should:
1. Show the spatial relationship between locations
2. Highlight the current location (if set)
3. Indicate which locations have been visited
4. Show major items at each location
5. Use ASCII art or similar text-based visualization

Make the map as clear and readable as possible.
`;

    this.dialogue.user(mapPrompt);
    const mapText = await this.generateAnalysis(mapPrompt);
    return mapText;
  }

  /**
   * Generate an analysis using the model
   */
  private async generateAnalysis(message: string): Promise<string> {
    const result = await generateText({
      model: this.model,
      messages: this.dialogue.messages,
    });

    this.dialogue.assistant(result.text);
    this.trackModelUsage(this.model.modelId, result.usage);

    return result.text;
  }

  /**
   * Get all locations
   */
  public getAllLocations(): Location[] {
    return Array.from(this.locations.values());
  }
}
