const html = new Proxy(
  {},
  {
    get(target, prop, receiver) {
      return ({ dataset = {}, ...attributes }) => {
        let div = document.createElement(prop);
        Object.entries(attributes).forEach(([key, value]) => {
          div[key] = value;
        });
        Object.entries(dataset).forEach(([key, value]) => {
          div.dataset[key] = value;
        });
        return div;
      };
    },
  }
);

export default html;
