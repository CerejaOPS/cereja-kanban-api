package com.cereja.kanban.application.auth;

public interface IDiscordProviderPort {
    String getAuthorizationUrl();
    String getAccessToken(String code);
    DiscordUserInfo getUserInfo(String accessToken);
}