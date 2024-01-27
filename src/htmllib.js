const html = new Proxy(
  {},
  {
    get(target, prop, receiver) {
      return (attributes) => {
        let div = document.createElement(prop);
        Object.entries(attributes).forEach(([key, value]) => {
          div[key] = value;
        });
        return div;
      };
    },
  }
);

export default html;
