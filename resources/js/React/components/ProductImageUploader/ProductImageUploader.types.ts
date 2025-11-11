import { ProductModel } from "@app/js/app.types";

export type ProductImageUploaderProps = {
    productModel: ProductModel;
}

export type ProductImageUploaderRef = {
    enabled: () => void;
    disabled: () => void;
}
