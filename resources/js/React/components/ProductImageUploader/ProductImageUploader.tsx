import { forwardRef, useImperativeHandle, useRef, useState } from "react";
import { ProductImageUploaderProps, ProductImageUploaderRef } from "./ProductImageUploader.types";
import { baseAxios } from "@app/js/services/axiosApi";

export default forwardRef<ProductImageUploaderRef, ProductImageUploaderProps>(
    function ProductImageUploader({ productModel }, ref) {
        const [isLoading, setIsLoading] = useState(false);
        const [isDisabled, setIsDisabled] = useState(false);
        const [successMessage, setSuccessMessage] = useState<string | null>(null);
        const [errorMessage, setErrorMessage] = useState<string | null>(null);
        const fileInputRef = useRef<HTMLInputElement>(null);

        useImperativeHandle(ref, () => ({
            enabled: () => {
                setIsDisabled(false);
            },
            disabled: () => {
                setIsDisabled(true);
            }
        }));

        const handleFileChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
            const file = event.target.files?.[0];
            
            if (!file) {
                return;
            }

            setSuccessMessage(null);
            setErrorMessage(null);
            setIsLoading(true);

            try {
                const formData = new FormData();
                formData.append("image", file);

                const response = await baseAxios.post(
                    `/api/products/${productModel.id}/image`,
                    formData,
                    {
                        headers: {
                            "Content-Type": "multipart/form-data"
                        }
                    }
                );

                setSuccessMessage("Imagem enviada com sucesso!");
                
                if (fileInputRef.current) {
                    fileInputRef.current.value = "";
                }

                setTimeout(() => {
                    setSuccessMessage(null);
                }, 5000);
            } catch (error: any) {
                const errorMsg = error.response?.data?.error || 
                    error.message || 
                    "Erro ao enviar imagem. Tente novamente.";
                
                setErrorMessage(errorMsg);

                setTimeout(() => {
                    setErrorMessage(null);
                }, 5000);
            } finally {
                setIsLoading(false);
            }
        };

        return (
            <div className="card border-0 shadow-sm rounded-4">
                <div className="card-body">
                    <h5 className="card-title mb-3">
                        <i className="fa-solid fa-image me-2" aria-hidden="true"></i>
                        Upload de Imagem
                    </h5>

                    <p className="text-muted small mb-3">
                        Produto: <strong>{productModel.name}</strong>
                    </p>

                    {successMessage && (
                        <div className="alert alert-success py-2 d-flex align-items-center" role="alert">
                            <i className="fa-solid fa-check-circle me-2" aria-hidden="true"></i>
                            {successMessage}
                        </div>
                    )}

                    {errorMessage && (
                        <div className="alert alert-danger py-2 d-flex align-items-center" role="alert">
                            <i className="fa-solid fa-exclamation-circle me-2" aria-hidden="true"></i>
                            {errorMessage}
                        </div>
                    )}

                    {isDisabled && (
                        <div className="alert alert-secondary py-2 d-flex align-items-center mb-3" role="alert">
                            <i className="fa-solid fa-lock me-2" aria-hidden="true"></i>
                            Upload desabilitado
                        </div>
                    )}

                    <div className="mb-3">
                        <label htmlFor="productImageInput" className="form-label">
                            Selecione uma imagem
                        </label>
                        <input
                            ref={fileInputRef}
                            id="productImageInput"
                            type="file"
                            className="form-control"
                            accept="image/*"
                            onChange={handleFileChange}
                            disabled={isDisabled || isLoading}
                        />
                        <small className="form-text text-muted d-block mt-2">
                            Formatos aceitos: JPG, PNG, GIF, WebP (máximo 5MB)
                        </small>
                    </div>

                    {isLoading && (
                        <div className="d-flex align-items-center justify-content-center py-3">
                            <div className="spinner-border spinner-border-sm text-primary me-2" role="status">
                                <span className="visually-hidden">Carregando...</span>
                            </div>
                            <span className="text-muted">Enviando imagem...</span>
                        </div>
                    )}

                    {!isLoading && !isDisabled && (
                        <small className="form-text text-muted d-block mt-2">
                            <i className="fa-solid fa-info-circle me-1" aria-hidden="true"></i>
                            Clique em "Selecione uma imagem" para enviar a foto do produto
                        </small>
                    )}
                </div>
            </div>
        );
    }
);
