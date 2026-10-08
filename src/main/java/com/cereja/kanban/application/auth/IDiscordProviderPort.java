package com.cereja.kanban.application.auth;

public interface IDiscordProviderPort {
    String getAccessToken(String code);
    DiscordUserInfo getUserInfo(String accessToken);
}
