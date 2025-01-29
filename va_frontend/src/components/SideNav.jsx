import { Link } from 'react-router-dom';
import './SideNav.css';

function SideNav({ routes, loginUrl }) {
  return (
    <nav className="side-nav">
      <ul className="nav-links">
        {/* Render only items with an alias */}
        {routes
          .filter(({ alias }) => alias) // Exclude items without alias
          .map(({ url, alias }) => (
            <li key={url}>
              <Link to={url}>{alias}</Link>
            </li>
          ))}
      </ul>
      <div className="nav-bottom">
        <Link to={loginUrl}>
          <button>Login</button>
        </Link>
      </div>
    </nav>
  );
}

export default SideNav;
