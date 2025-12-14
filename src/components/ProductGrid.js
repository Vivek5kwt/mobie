import React, { useEffect, useState } from "react";
import {
  View,
  Text,
  Image,
  TouchableOpacity,
  FlatList,
  StyleSheet,
} from "react-native";
import Icon from "react-native-vector-icons/FontAwesome6";
import { fetchShopifyProducts } from "../services/shopify";

export default function ProductGrid({ section }) {
  const props = section?.properties?.props?.properties || {};

  const title = props?.title?.value || "";
  const titleSize = props?.titleSize?.value || 18;
  const alignText = (props?.alignText?.value || "Left").toLowerCase();

  const limit =
    props?.limit?.value ||
    props?.productCount?.value ||
    props?.productsToShow?.value ||
    4;

  const favEnabled =
    props?.favEnabled?.value ||
    props?.showFavorite?.value ||
    props?.showFavoriteIcon?.value ||
    false;

  const [products, setProducts] = useState([]);

  useEffect(() => {
    fetchShopifyProducts(limit).then(setProducts);
  }, [limit]);

  const renderItem = ({ item }) => (
    <View style={styles.card}>
      <Image source={{ uri: item.image }} style={styles.image} />

      <Text numberOfLines={1} style={styles.name}>
        {item.name}
      </Text>

      <Text style={styles.price}>
        {item.currency} {item.price}
      </Text>

      {favEnabled && (
        <TouchableOpacity style={styles.favIcon}>
          <Icon name="heart" size={18} color="red" />
        </TouchableOpacity>
      )}
    </View>
  );

  return (
    <View style={styles.wrapper}>
      <Text
        style={{
          fontSize: titleSize,
          fontWeight: "700",
          marginBottom: 12,
          textAlign: alignText,
        }}
      >
        {title}
      </Text>

      <FlatList
        data={products}
        renderItem={renderItem}
        keyExtractor={(item) => item.id}
        numColumns={2}
        columnWrapperStyle={{ justifyContent: "space-between" }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: { padding: 12 },
  card: {
    width: "48%",
    backgroundColor: "#fff",
    padding: 10,
    borderRadius: 10,
    elevation: 2,
    marginBottom: 12,
    position: "relative",
  },
  image: {
    width: "100%",
    height: 130,
    backgroundColor: "#eee",
    borderRadius: 8,
  },
  name: { marginTop: 5 },
  price: { marginTop: 4, fontWeight: "bold" },
  favIcon: { position: "absolute", top: 10, right: 10 },
});
