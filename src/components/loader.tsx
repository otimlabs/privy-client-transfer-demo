import "./loader.css";

export function Loader() {
  return (
    <div className="loader">
      <div className="loader__content">
        <div className="loader__spinner">
          <div className="loader__spinner-ring"></div>
        </div>
        <p className="loader__text">Loading...</p>
      </div>
    </div>
  );
}
