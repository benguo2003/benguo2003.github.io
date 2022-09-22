import woman from './images/woman.jpg';
import './App.css';
import React from 'react';

function App() {
  return (
    <div className="App">
      <header className="App-header">
      <img id='woman' src={woman} alt="woman"/>
        <p>
          Woman, Colorized circa 2022.
        </p>
      </header>
    </div>
  );
}

export default App;
