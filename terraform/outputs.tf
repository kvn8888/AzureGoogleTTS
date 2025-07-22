output "function_app_name" {
  description = "Name of the Function App"
  value       = azurerm_linux_function_app.main.name
}

output "function_app_url" {
  description = "URL of the Function App"
  value       = "https://${azurerm_linux_function_app.main.default_hostname}"
}

output "function_app_api_url" {
  description = "API endpoint URL for the text-to-speech function"
  value       = "https://${azurerm_linux_function_app.main.default_hostname}/api/textToSpeech"
}

output "resource_group_name" {
  description = "Name of the resource group"
  value       = azurerm_resource_group.main.name
}

output "storage_account_name" {
  description = "Name of the storage account"
  value       = azurerm_storage_account.main.name
}

output "app_insights_name" {
  description = "Name of Application Insights"
  value       = azurerm_application_insights.main.name
}