# MyLife Member Services Application

## Overview

### MyLife: Preserving Member Stories for Posterity

MyLife is a groundbreaking initiative aimed at capturing and preserving the essence of human experiences for future generations. We believe in the power of personal stories, memories, and media to shape our understanding of the human condition. Our platform provides a unique, enduring, and internet-based solution for individuals to record and showcase their life stories.
Additionally, with a raft of bot-assistants, ranging from personal admin to creative writing assistance to health tracking and monitoring to much more, you have access to powerful intelligent tools to help you manage and create in your daily life.

#### Vision and Mission

- **Mission**: Committed to offering a durable, enduring, and free platform for collecting and showcasing individual stories, media, and memories. We create a living, evolving encyclopedia of our selves where experiences and memory can be shared to the degree we consent. We provide superintelligent workspaces to get all of your personal or public work to get done.
- **Vision**: To enable every individual to be remembered forever, sharing their passions, wisdom, and experiences with posterity. We strive to create Earth's Library of Humanity in the metaverse, preserving 21st-century experiences as a permanent record.

### MyLife Member Services

MyLife Member Services are currently in closed alpha, but rolling admission to the alpha is granted every Monday, and you can register for free either at [the MyLife website](https://humanremembranceproject.org) or [our GPT-Store](https://chat.openai.com/g/g-rEjoOt9hN-mylife). We cannot wait to be able to provide these services to every human on earth, as MyLife fundamentally believes that a smarter humanity that leverages smarter tools will become a safer, more secure, and more ethical humanity.

#### Key Features

- **Personalized Experience**: Tailored tools for individual story creation and memorialization.
- **Community Engagement**: Opportunities for members to interact, contribute, and learn from each other.
- **Educational Resources**: Access to lectures, presentations, and initiatives focusing on posterity archiving.
- **Fundraising and Support**: Options for direct donations, member dues, and other forms of support to sustain the platform.

#### Goals and Values

- **Primary Goals**: Capture and preserve living stories and beliefs for posterity, providing an immortal legacy for every individual.
- **Ethical Aims**: Foster introspection, empathy, digital justice, and equity.
- **Values**: Emphasis on data dignity, consent, authenticity, and personal security.

## Table of Contents

- [Overview](#overview)
  - [MyLife](#mylife-preserving-member-stories-for-posterity)
  - [MyLife Member Services](#mylife-member-services)
- [Features](#features)
- [Getting Started](#getting-started)
  - [Prerequisites](#prerequisites)
  - [Installation](#installation)
- [Architecture](#architecture)
- [API Documentation](#api-documentation)
- [Appendix](#appendix)
  - [License](#license)
  - [Contact](#contact)
  - [Notes](#appendix-notes)

## Features

The MyLife platform offers a comprehensive suite of services that leverage advanced AI technology to enhance digital experiences for its members. The key features and services available to MyLife members are as follows:

1. **AI-Avatars**
   - Members can run a legion of AI-powered bots, customizable to their needs.
   - These avatars can be tailored to reflect aspects of the member's personality or expertise.
   - They use OpenAI's GPT technology, allowing them to perform a wide range of tasks.

2. **Bot Functionality**
   - The platform offers various specialized bots, such as:
     - Personal-Assistant-bot for daily tasks and calendaring.
     - Biographer-bot for capturing and sharing personal stories and experiences.
     - Health-bot for fitness and medication tracking.
     - Finance-bot for financial management.
     - Resume-bot for animating and presenting resumes or CVs.
   - and many more!
   - These bots can be customized and are capable of evolving with the member's needs.

3. **My Indiverse**:
   - A creative platform where members can bring their imaginations to life.
   - Members can create intelligent objects or art and design virtual worlds.
   - This service encourages creativity and interaction within the MyLife network.

4. **Protected Web-Browsing**:
   - Features a DOM-Agent that intelligently re-renders external assets based on consent preferences.
   - Enhances online security and privacy for members.

5. **Full-Spectrum Permissioning**:
   - Utilizes natural language processing to develop an array of consents and preferences.
   - Allows members to control their public and private online presence.

6. **Technical Assistance Services**:
   - Offers hosting opportunities for personalized digital spaces.
   - Enables members to create themed networks or partner platforms.
   - Members can extend the functionality of MyLife and contribute to the community.

7. **Contribution to My Indiverse**:
   - A platform for members to showcase their creativity and contributions.
   - Encourages fun, learning, and innovation.

8. **Platform Improvement Suggestions**:
   - MyLife values member input for platform enhancement.
   - Members can suggest improvements, reflecting the diverse needs of the community.

In summary, MyLife's Member Services are designed to provide a rich, interactive, and personalized digital experience, leveraging AI technology to meet a wide range of member needs and preferences. The platform's focus on creativity, customization, and member contribution makes it a unique space for personal and community growth.

## Getting Started

This guide will help you get the MyLife Member Services application up and running on either your local development machine or even a hosted member services solution. We'll walk you through setting up your environment, installing the necessary dependencies, and starting the application.

We do not yet have a team focused on local implementation details, and these instructions were only tested on VSCode running on a Windows 11 OS.

### Prerequisites

Before you begin, ensure you have the following installed on your machine:

- **Node.js**: The application is built on Node.js. You need Node.js installed to run the server. Download and install it from [nodejs.org](https://nodejs.org/).
- **npm (Node Package Manager)**: npm is used to manage the application's dependencies. npm is included with Node.js, so when you install Node.js, you automatically get npm installed on your computer.
- **Git**: Git is used for version control and is required to clone the repository. Install it from [git-scm.com](https://git-scm.com/).
- **IDE**: We recommend an Integrated Development Environment (IDE) to write and edit code, but also to host the MyLife Node.js server, we use Visual Studio Code.

### Installation

1. **Clone the repository**: First, clone the MyLife Member Services repository to your local machine using Git. Open your terminal, navigate to the directory where you want to store the project, and run:

   ```bash
   git clone https://github.com/MyLife-Services/mylife-maht.git
   cd mylife-maht
   ```

2. **Install dependencies**: Once you have the project on your machine, you need to install its dependencies. Run the following command in the root directory of the project:

   ```bash
   npm install
   ```

   This command reads the `package.json` file and installs all the required Node.js packages listed in it.

3. **Environment Setup**: The application requires an environment setup. Create a `.env` file in the root of your project and add the necessary environment variables. Refer to the provided `.env.example` file for required keys. MyLife plans to offer self-retrieval keys for any data transfers, but for the time being, if you wish to run a hosted solution for friends, family or other community congregation, you will have to be vetted internally by connectingm with our technical leads @stratfordCircle Steve Kenney or @Mookse Erik Jespersen also reachable at <mylife.president@gmail.com>.

4. **Run the application**: After installing the dependencies and setting up the environment, you can start the application.

   - local development: runs nodemon that watches certain files for server reload

   ```bash
    npm run dev
    ```

   - hosted environment: when running your own server, you can shortcut with

   ```bash
    npm start
    ```

   This should start the server, typically on `http://localhost:3000`. Open a web browser and navigate to this URL to interact with the application.

Congratulations! You should now have the MyLife Member Services application running on your local machine. For further information on usage and development, refer to the subsequent sections of this README.

## Architecture

The architecture of MyLife Member Services is meant to be scalable from production-level down to self-hosting, an intended architectural feature of the platform, enabling anyone world-wide to host an instantiation of MyLife Services for a group or coalition of members, so long as those users are registered and validated within the mainframe itself.

MyLife itself is an open-source project and, aside from LLM technologies at the core of its intelligence, it is built on open-source technologies. This architecture integrates various technologies and npm packages, enabling a diverse set of functionalities such as member login, bot-legion capabilities, and session management.

### Core Architecture

1. **Server-Side Application**
   - Built using Node.js, a powerful JavaScript runtime, to handle server-side operations.
   - Utilizes Koa.js, a web framework for Node.js, which is known for its lightweight and modular nature. Koa's middleware stack flows in a stack-like manner, allowing for more expressive and robust server-side development.

2. **Data Handling and Services**
   - The application uses Azure Cosmos DB and PostgreSQL databases for data management, as indicated in the `mylife-data-service.js` file.
   - It employs a data service layer (`Dataservices` class) to manage interactions with the data layers, offering methods for CRUD operations, handling avatars, bots, alerts, and other core elements.

3. **Bot Functionality and Intelligence Management**
   - The application features a sophisticated bot system, capable of creating and managing different types of bots like personal assistants, biographers, health bots, etc.
   - OpenAI's GPT-3 model is integrated for generating responses and interacting with users through bots, as observed in the `mylife-avatar.mjs` and `mylife-factory.mjs` files.

4. **Session Management**
   - Managed through the `MylifeMemberSession` class, handling user sessions, consents, and alerts.
   - Utilizes EventEmitter for managing and emitting custom events.

5. **Routing and API Handling**
   - The system uses Koa Router for handling HTTP requests, defining routes for various functionalities like member access, bot activation, and content contributions.

6. **Front-End Interaction**
   - The system leverages an EJS front-end page view system
   - Core functionality executed through REST endpoints
   - CSS relies on flex, bootstrap and font-awesome

### NPM Packages and Dependencies

1. **Core Dependencies**
   - `koa` and related packages (`koa-router`, `koa-static`, `koa-body`, etc.) for web server framework.
   - `openai` for integrating OpenAI's GPT models.
   - `azure/cosmos` and `pg` for interacting with Azure Cosmos DB and PostgreSQL databases.
   - `events` for event emission handling.
   - `chalk` for terminal string styling.

2. **Utilities and Helpers**
   - `ajv` for JSON schema validation.
   - `js-guid` for GUID generation.
   - `marked` for markdown parsing.

3. **Development Tools**
   - `eslint` for code linting.
   - `nodemon` for automatically restarting the node application when file changes are detected.

4. **Miscellaneous**
   - `url`, `path`, `fs`, `util`, and other Node.js built-in modules for various utility functions.

## API Documentation

While API interactions could certainly be divined by code review, we have currently not pointed an intelligence at it, but it will arrive soon.

## Appendix

### License

This project is licensed under the MIT License - see the [LICENSE](#mit-license) file for details.

#### MIT License

Copyright (c) 2024 [MyLife](https://humanremembranceproject.org)

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.

### Contact

You may contact either Erik Jespersen @Mookse or Steve Kenney @stratfordCircle at github with any technical questions.
Additionally, you could visit the main [MyLife website](https://humanremembranceproject.org) at <mylife.president@gmail.com>.

### Appendix Notes

- add resources/references section to this document
