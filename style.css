 :root {
            --bg: #050505;
            --card: #111;
            --green: #00ff88;
            --red: #ff4444;
        }
        body {
            background: var(--bg);
            color: white;
            font-family: 'Courier New', monospace;
            display: flex;
            justify-content: center;
            /* 2. ADJUSTED PADDING: Less padding for small screens */
            padding: 20px;
            margin: 0;
        }
        .dashboard {
            width: 100%;
            max-width: 800px;
            border: 1px solid #333;
            padding: 20px;
            box-sizing: border-box; /* Ensures padding doesn't break width */
        }
        header {
            display: flex;
            justify-content: space-between;
            align-items: center;
            flex-wrap: wrap; /* Allows header text to wrap on very small phones */
            gap: 10px;
        }
        
        /* 3. RESPONSIVE GRID: Change from 3 columns to 1 column on mobile */
        .stats-grid {
            display: grid;
            grid-template-columns: repeat(3, 1fr); /* Default 3 columns */
            gap: 15px;
            margin: 20px 0;
        }

        /* MEDIA QUERY: If the screen is smaller than 600px... */
        @media (max-width: 600px) {
            .stats-grid {
                grid-template-columns: 1fr; /* Stack cards on top of each other */
            }
            header h1 {
                font-size: 1.5rem; /* Shrink title slightly for mobile */
            }
        }

        .card {
            background: var(--card);
            padding: 15px;
            border-radius: 4px;
            border-bottom: 2px solid #333;
            min-height: 100px;
        }
        .accent { border-bottom-color: var(--green); }
        #data-val, #cpu-val, #carbon-val {
            font-size: 1.5rem;
            font-weight: bold;
            margin: 10px 0;
        }
        button {
            margin-right: 10px;
            margin-bottom: 10px; /* Space between buttons when stacked */
            padding: 10px 20px; /* Larger tap target for fingers */
            cursor: pointer;
            border: none;
            border-radius: 3px;
            background: var(--green);
            color: #000;
            font-weight: bold;
        }
        button.stop { background: var(--red); color: #fff; }
