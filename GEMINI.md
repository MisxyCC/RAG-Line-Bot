# pealife-line-bot

## Project Overview
This project is a Cloudflare Worker written in TypeScript that functions as a LINE Messaging API bot. It uses Google's Gemini API (specifically the `gemini-3.1-flash-lite-preview` model) to act as a friendly and helpful assistant named "น้อง Botty". 

The bot is designed to answer employee or user questions based on a predefined knowledge base loaded from `src/optimized_knowledge.json`. It includes security features like LINE signature verification and prompt injection mitigation.

### Main Technologies
* **Runtime / Deployment:** Cloudflare Workers (`wrangler`)
* **Language:** TypeScript
* **Integration:** LINE Messaging API, Google Gemini API
* **Testing:** Vitest

## Environment Variables
To run this project, you will need to set up the following environment variables (defined in `src/index.ts` under the `Env` interface):
* `GEMINI_API_KEY`: Your Google Gemini API key.
* `LINE_CHANNEL_ACCESS_TOKEN`: Your LINE bot's channel access token.
* `LINE_CHANNEL_SECRET`: Your LINE bot's channel secret for signature verification.

## Building and Running
The project uses `npm` (or another package manager like `yarn`/`pnpm`) and `wrangler` for development and deployment. The following scripts are available in `package.json`:

* **Start Development Server:** 
  ```bash
  npm run dev
  # or
  npm start
  ```
  This command runs `wrangler dev` to start a local development environment.

* **Deploy to Cloudflare:**
  ```bash
  npm run deploy
  ```
  This command runs `wrangler deploy` to publish the worker.

* **Run Tests:**
  ```bash
  npm run test
  ```
  This command runs the `vitest` test suite.

* **Generate Cloudflare Types:**
  ```bash
  npm run cf-typegen
  ```
  This command runs `wrangler types` to update TypeScript definitions based on `wrangler.jsonc` and bindings.

## Development Conventions
* **Code Style:** The project uses TypeScript. There is a `.prettierrc` file present, indicating that Prettier is used for code formatting.
* **Architecture:** 
  * The main entry point is `src/index.ts`, which handles the webhook `POST` requests from LINE.
  * The system prompt for the AI is constructed during the cold start of the worker by reading from `src/optimized_knowledge.json`, optimizing performance by not recreating it on every request.
  * The bot is instructed to format responses specifically for the LINE app (e.g., avoiding Markdown bold/italics, using emojis, and keeping the tone empathetic and friendly).
* **Testing:** Tests are located in the `test/` directory (`test/index.spec.ts`) and use `@cloudflare/vitest-pool-workers` to simulate the Cloudflare Workers environment.