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

            {/* Right Panel - Sign Up */}
            <div className="right-panel">
            <p>Don’t have an account?</p>
            <button className="sign-up-button">Sign up</button>
            </div>
        </div>
    );
}

export default LoginForm;