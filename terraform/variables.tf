variable "resource_group_name" {
  description = "Name of the resource group"
  type        = string
  default     = "rg-azure-google-tts"
}

variable "location" {
  description = "Azure region for resources"
  type        = string
  default     = "East US"
}

variable "storage_account_name" {
  description = "Name of the storage account (must be globally unique)"
  type        = string
  default     = "stttsdemostorage"
}

variable "app_service_plan_name" {
  description = "Name of the App Service Plan"
  type        = string
  default     = "asp-azure-google-tts"
}

variable "function_app_name" {
  description = "Name of the Function App (must be globally unique)"
  type        = string
  default     = "func-azure-google-tts"
}

variable "app_insights_name" {
  description = "Name of Application Insights"
  type        = string
  default     = "ai-azure-google-tts"
}

variable "google_credentials_json" {
  description = "Google Cloud service account credentials as JSON string"
  type        = string
  sensitive   = true
  default     = null
}