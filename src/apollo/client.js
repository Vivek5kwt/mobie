import { ApolloClient, InMemoryCache, HttpLink } from "@apollo/client";

const client = new ApolloClient({
  link: new HttpLink({
    uri: "https://mobidrag.ampleteck.com/graphql",
  }),
  cache: new InMemoryCache(),
});

export default client;
