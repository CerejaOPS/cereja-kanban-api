package com.cereja.kanban.infrastructure.discord;

import com.cereja.kanban.application.auth.AuthenticationFailedException;
import com.cereja.kanban.application.auth.DiscordUserInfo;
import com.cereja.kanban.application.auth.IDiscordProviderPort;
import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import com.fasterxml.jackson.annotation.JsonProperty;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.MediaType;
import org.springframework.stereotype.Component;
import org.springframework.util.LinkedMultiValueMap;
import org.springframework.util.MultiValueMap;
import org.springframework.web.client.RestClient;
import org.springframework.web.client.RestClientException;

@Component
public class DiscordProviderAdapter implements IDiscordProviderPort {

    private final RestClient restClient;
    private final String clientId;
    private final String clientSecret;
    private final String redirectUri;


    public DiscordProviderAdapter(@Value("${discord.client-id}") String clientId,
                                  @Value("${discord.client-secret}") String clientSecret,
                                  @Value("${discord.redirect-uri}") String redirectUri) {
        this.clientId = clientId;
        this.restClient = RestClient.builder().baseUrl("https://discord.com/api").build();
        this.clientSecret = clientSecret;
        this.redirectUri = redirectUri;
    }

    /** Resposta do endpoint /oauth2/token (formato do Discord, uso interno). */
    private record DiscordTokenResponse(@JsonProperty("access_token") String accessToken) {}

    @JsonIgnoreProperties(ignoreUnknown = true)
    private record DiscordUserResponse(String id, String username, String avatar){}

    /**
     * Troca o código de autorização pelo access_token do Discord.
     * @param code código recebido no callback do OAuth2
     * @return access_token do usuário
     */
    @Override
    public String getAccessToken(String code) {
        MultiValueMap<String, String> form = new LinkedMultiValueMap<>();
        form.add("client_id", this.clientId);
        form.add("client_secret", this.clientSecret);
        form.add("grant_type", "authorization_code");
        form.add("code", code);
        form.add("redirect_uri", this.redirectUri);

        try{
            DiscordTokenResponse response = restClient.post()
                    .uri("/v10/oauth2/token")
                    .contentType(MediaType.APPLICATION_FORM_URLENCODED)
                    .body(form)
                    .retrieve()
                    .body(DiscordTokenResponse.class);

            if(response == null || response.accessToken() == null || response.accessToken().isBlank()){
                throw new AuthenticationFailedException("Token de acesso inválido ou não recebido pela API do Discord.");
            }

            return response.accessToken();

        } catch (RestClientException e) {
            throw new AuthenticationFailedException("Falha ao autenticar com o Discord. " + e.getMessage(), e);
        }
    }

    @Override
    public DiscordUserInfo getUserInfo(String accessToken) {
        try{
            return restClient.get()
                    .uri("/v10/users/@me")
                    .header("Authorization", "Bearer " + accessToken)
                    .retrieve()
                    .body(DiscordUserInfo.class);


        }catch (RestClientException e){
            throw new AuthenticationFailedException("Falha ao buscar dados do usuário: " + e.getMessage(), e);
        }
    }

//    @Override
//    public DiscordUserInfo getUserInfo(String accessToken) {
//        try{
//            return restClient.get()
//                    .uri("/v10/users/@me")
//                    .header("Authorization", "Bearer " + accessToken)
//                    .retrieve()
//                    .body(DiscordUserInfo.class);
//
//
//        }catch (RestClientException e){
//            throw new AuthenticationFailedException("Falha ao buscar dados do usuário: " + e.getMessage(), e);
//        }
//    }
}