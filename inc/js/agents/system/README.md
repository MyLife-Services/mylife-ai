# MyLife System Assistants

The MyLife system incorporates a suite of specialized assistants, each designed to augment various aspects of the avatars within the platform. These assistants follow consistent coding protocols and are currently intended exclusively for integration with avatars, enhancing their functionality and interactivity.

- **Asset-Agent**: (File Handler) This agent manages file-related operations, ensuring efficient handling, storage, and retrieval of files within the system. It acts as a central hub for file management tasks, streamlining the process of dealing with various file formats and data types.

- **Bot-Agent**: (Bot Handler) One of the most fundamental agents available, represents an object that manages the menagerie of Bots allocated to the current member's team. Also manages Teams.

- **Collections-Agent**: (Lists Handler) This agent manages collections for mass operations.

- **DOM-Assistant**: The Document Object Model (DOM) Assistant is pivotal in managing and manipulating the structure of data and documents within the system. It plays a key role in ensuring the data is organized and accessible in a way that is both efficient and intuitive.

- **Evolution-Assistant**: Central to the avatar's developmental journey, the Evolution Assistant orchestrates the growth and maturation of avatars. It guides avatars through different phases of evolution, from creation to retirement, tailoring the development process according to the avatar's specific needs and contexts.

- **Preferences-Assistant**: This assistant is dedicated to personalizing user experiences by managing and adapting to user preferences. It ensures that avatars can cater to individual tastes and requirements, making interactions more tailored and relevant.

- **Settings-Assistant**: Focused on configuration management, the Settings Assistant allows for the customization and adjustment of system settings. This ensures that avatars can operate within the parameters that best suit the user's needs and the system's operational environment.

- **Connector-Assistant (External Service Manager)**: Acting as a bridge to the outside world, the Connector Assistant manages interactions with external services and platforms. Whether it's cloud services, music, information databases, or external avatar services, this assistant facilitates seamless integration and interaction with a variety of external resources and services.

Each of these assistants contributes to a more dynamic, efficient, and personalized avatar experience within the MyLife system. By specializing in different domains, they collectively enhance the overall functionality and adaptability of the avatars, making them more capable and versatile in serving the users' diverse needs.

## Evolution Assistant (Evo-Agent)

### Overview

The Evolution Assistant, referred to as Evo-Agent, is a core component in the MyLife asset-assistant project. It is implemented in the `evolution-assistant.mjs` file and serves as an integral part of the system, managing the evolutionary process of avatars within the MyLife platform.

### Design and Functionality

- **Class Definition**: `EvolutionAssistant` class extends `EventEmitter`.
- **Private Members**:
  - `#avatar`: A reference to the symbiotic avatar object.
  - `#contributions`: An array to manage contributions related to the avatar.
  - `#phase`: Tracks the current phase of evolution, such as 'create', 'init', 'develop', etc.
- **Constructor**:
  - Initializes the Evo-Agent with a default phase and binds it to a specific avatar.
- **Key Methods**:
  - `init()`: Initializes the Evo-Agent, setting up initial contributions.
  - `avatar()`, `being()`, `categories()`, etc.: Getters for various avatar properties.
  - `#advancePhase()`: A private method to advance the evolutionary phase of the avatar.

### Event Handling

The Evo-Agent is designed to emit events at different stages of its lifecycle, signaling the beginning and completion of various phases. It leverages Node.js's `EventEmitter` for event-driven programming.

### Modular Design

The codebase follows a modular approach, with functions like `mAdvancePhase()` and `mAssessData()` externalized for specific operations, maintaining a clean and manageable structure.

### Phases of Evolution

The Evo-Agent guides the avatar through multiple phases:

- `create`
- `init`
- `develop`
- `mature`
- `maintain`
- `retire`

Each phase has specific goals and criteria, ensuring a comprehensive and dynamic evolution process for the avatar.

### Contribution Management

The Evo-Agent actively manages contributions that aid in the growth and development of the avatar. It assesses and selects categories most in need of contributions, facilitating continuous evolution.

## Appendix

### Notes

modular assistants, not actual agents, but system functionality that can be used _by_ agents
all outputs thereby should be in the form of a consistent class, that is at least initially defined by the global config at its heart (i.e., inclusive at least, if one-day not fully birthed from, the raw json config file)
