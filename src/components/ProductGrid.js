import React, { useEffect, useState } from "react";
import {
  View,
  Text,
  Image,
  TouchableOpacity,
  FlatList,
  StyleSheet,
  useWindowDimensions,
} from "react-native";
import Icon from "react-native-vector-icons/FontAwesome6";
import { fetchShopifyProducts } from "../services/shopify";

export default function ProductGrid({ section }) {
  const { width } = useWindowDimensions();
  const isTablet = width >= 768;
  const numColumns = width >= 900 ? 4 : width >= 700 ? 3 : 2;
  const cardSpacing = isTablet ? 16 : 12;
  const horizontalPadding = isTablet ? 20 : 12;
  const cardWidth = (width - horizontalPadding * 2 - cardSpacing * (numColumns - 1)) / numColumns;

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

  const renderItem = ({ item, index }) => {
    const isLastInRow = (index + 1) % numColumns === 0;

    return (
      <View
        style={[
          styles.card,
          {
            width: cardWidth,
            marginRight: isLastInRow ? 0 : cardSpacing,
            marginBottom: cardSpacing,
          },
        ]}
      >
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
  };

  return (
    <View style={[styles.wrapper, { paddingHorizontal: horizontalPadding }]}>
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
        numColumns={numColumns}
        key={numColumns}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{
          paddingBottom: cardSpacing * 2,
          paddingTop: 4,
        }}
        columnWrapperStyle={{
          justifyContent: "flex-start",
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: { paddingVertical: 12 },
  card: {
    backgroundColor: "#fff",
    padding: 10,
    borderRadius: 10,
    elevation: 2,
    position: "relative",
    shadowColor: "#000",
    shadowOpacity: 0.08,
    shadowOffset: { width: 0, height: 2 },
    shadowRadius: 6,
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
