# CodeGraph Offline Analyzer

A powerful static code analysis tool that visualizes your project's structure as an interactive force-directed graph. This application operates entirely offline.

## Features

*   **100% Offline & Secure**: Code analysis happens locally in your browser.
*   **Multi-Language Support**: Python, JS/TS, C/C++, Java.
*   **Interactive Visualization**: Zoom, pan, drag, and explore your code architecture.

## Installation & Usage (Python/Pip)

Since you do not have `npm`, this application is set up to run via a minimal Flask server that serves the React application. The application uses Babel Standalone to compile the TypeScript code directly in the browser.

### Prerequisites

*   Python 3.x
*   pip

### Setup

1.  **Install Dependencies**:
    ```bash
    pip install -r requirements.txt
    ```

2.  **Run the Application**:
    ```bash
    python app.py
    ```

3.  **Access**:
    Open your browser and go to: `http://localhost:5000`

## Usage Guide

1.  **Upload Code**: Click "Select Project Directory" and select a folder containing source code.
2.  **Analyze**: The graph will automatically generate.
3.  **Explore**: Click nodes to view the source code, or use the search bar to find specific code segments.

## License

MIT License
