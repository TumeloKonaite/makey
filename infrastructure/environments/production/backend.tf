terraform {
  backend "azurerm" {
    key              = "rooms-marketplace/production/container-apps.tfstate"
    use_azuread_auth = true
  }
}
