import './LoginPage.css';

function LoginForm(){
    return (
        <div className="login-container">
            {/* Left Panel - Sign In */}
            <div className="left-panel">
                <h1>Sign In</h1>

                <label>Username</label>
                <input type="text" placeholder="Username" className="input-box" />

                <label>Password</label>
                <input type="password" placeholder="Password" className="input-box" />

                <button className="sign-in-button">Sign in</button>
            </div>
        </div>
    );
}

export default LoginForm;