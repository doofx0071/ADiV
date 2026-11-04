package expo.modules.adivofflinebridge

import android.content.Context
import android.os.Handler
import android.os.Looper
import com.mapbox.bindgen.Value
import com.mapbox.common.Cancelable
import com.mapbox.common.MapboxOptions
import com.mapbox.common.OfflineSwitch
import com.mapbox.common.TileStore
import com.mapbox.common.TileRegion
import com.mapbox.common.TileRegionError
import com.mapbox.common.TileRegionLoadOptions
import com.mapbox.common.TileRegionLoadProgress
import com.mapbox.common.TileRegionEstimateProgress
import com.mapbox.common.location.Location
import com.mapbox.geojson.Point
import com.mapbox.geojson.Polygon
import com.mapbox.maps.GlyphsRasterizationMode
import com.mapbox.maps.MapboxMapsOptions
import com.mapbox.maps.OfflineManager
import com.mapbox.maps.StylePack
import com.mapbox.maps.StylePackCallback
import com.mapbox.maps.StylePackLoadOptions
import com.mapbox.maps.StylePackLoadProgressCallback
import com.mapbox.maps.TilesetDescriptorOptions
import com.mapbox.navigation.base.extensions.applyDefaultNavigationOptions
import com.mapbox.navigation.base.options.NavigationOptions
import com.mapbox.navigation.base.options.RoutingTilesOptions
import com.mapbox.navigation.base.route.NavigationRoute
import com.mapbox.navigation.base.route.NavigationRouterCallback
import com.mapbox.navigation.base.route.RouterFailure
import com.mapbox.navigation.base.route.RouterOrigin
import com.mapbox.navigation.base.trip.model.RouteProgress
import com.mapbox.navigation.core.MapboxNavigation
import com.mapbox.navigation.core.MapboxNavigationProvider
import com.mapbox.navigation.core.arrival.ArrivalObserver
import com.mapbox.navigation.core.directions.session.RoutesObserver
import com.mapbox.navigation.core.directions.session.RoutesExtra
import com.mapbox.navigation.core.trip.session.LocationMatcherResult
import com.mapbox.navigation.core.trip.session.LocationObserver
import com.mapbox.navigation.core.trip.session.OffRouteObserver
import com.mapbox.navigation.core.trip.session.RouteProgressObserver as CoreRouteProgressObserver
import com.mapbox.navigation.core.trip.session.VoiceInstructionsObserver
import com.mapbox.api.directions.v5.DirectionsCriteria
import com.mapbox.api.directions.v5.models.RouteOptions
import com.mapbox.core.constants.Constants
import com.mapbox.geojson.LineString
import expo.modules.kotlin.Promise
import expo.modules.kotlin.functions.Queues
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition
import java.io.File
import java.util.UUID
import java.util.concurrent.ConcurrentHashMap
import java.util.concurrent.atomic.AtomicBoolean

private data class StoredRoute(
  val routes: List<NavigationRoute>,
  val source: String,
  val destination: Point,
)

class AdiVMapboxModule : Module() {
  private companion object {
    private const val MAPS_SDK_VERSION = "11.33.1"
    private const val NAVIGATION_SDK_VERSION = "3.33.1"
    private const val ROUTING_PROFILE = "driving"
    private const val OFFLINE_ROUTE_TIMEOUT_MS = 20_000L
  }

  private val routes = ConcurrentHashMap<String, StoredRoute>()
  private val downloads = ConcurrentHashMap<String, Cancelable>()
  private val offlineRouteLock = Any()
  private var offlineRouteRequestCount = 0
  private var mapboxStackConnectedBeforeOfflineRoute = true
  private var tileStore: TileStore? = null
  private var navigation: MapboxNavigation? = null
  private var activeRouteId: String? = null
  private var activeOfflineOnly = false
  private var observersRegistered = false
  private var tripSessionStarted = false
  private var latestLocation: Location? = null
  private var offlineRerouteInProgress = false
  private var offlineRerouteWaitingForLocation = false

  private val routeProgressObserver = CoreRouteProgressObserver { progress ->
    val legProgress = progress.currentLegProgress
    val stepProgress = legProgress?.currentStepProgress
    val step = stepProgress?.step
    sendEvent(
      "onRouteProgress",
      mapOf(
        "distanceRemaining" to progress.distanceRemaining,
        "stepDistanceRemaining" to (stepProgress?.distanceRemaining ?: 0.0),
        "instruction" to (step?.maneuver()?.instruction() ?: ""),
        "legIndex" to (legProgress?.legIndex ?: 0),
      ),
    )
  }

  private val routesObserver = RoutesObserver { result ->
    if (result.reason == RoutesExtra.ROUTES_UPDATE_REASON_REROUTE && result.navigationRoutes.isNotEmpty()) {
      val currentId = activeRouteId ?: return@RoutesObserver
      val existing = routes[currentId]
      val routeSource = "unknown"
      val destination = existing?.destination ?: return@RoutesObserver
      val updated = StoredRoute(result.navigationRoutes, routeSource, destination)
      val newId = UUID.randomUUID().toString()
      routes[newId] = updated
      activeRouteId = newId
      sendEvent("onRouteChanged", routePayload(newId, updated.routes, updated.source))
    }
  }

  private val locationObserver = object : LocationObserver {
    override fun onNewRawLocation(rawLocation: Location) = Unit

    override fun onNewLocationMatcherResult(locationMatcherResult: LocationMatcherResult) {
      latestLocation = locationMatcherResult.enhancedLocation
      if (activeOfflineOnly && offlineRerouteWaitingForLocation) {
        offlineRerouteWaitingForLocation = false
        requestOfflineReroute()
      }
    }
  }

  private val offRouteObserver = OffRouteObserver { offRoute ->
    sendEvent("onOffRoute", mapOf("offRoute" to offRoute))
    if (!offRoute) offlineRerouteWaitingForLocation = false
    if (offRoute && activeOfflineOnly) requestOfflineReroute()
  }

  private val arrivalObserver = object : ArrivalObserver {
    override fun onWaypointArrival(routeProgress: RouteProgress) {
      val legIndex = routeProgress.currentLegProgress?.legIndex ?: 0
      sendEvent("onArrival", mapOf("waypointIndex" to legIndex + 1, "isFinalDestination" to false))
    }

    override fun onNextRouteLegStart(routeLegProgress: com.mapbox.navigation.base.trip.model.RouteLegProgress) = Unit

    override fun onFinalDestinationArrival(routeProgress: RouteProgress) {
      sendEvent("onArrival", mapOf("waypointIndex" to (routeProgress.navigationRoute.directionsRoute.legs()?.size ?: 1), "isFinalDestination" to true))
    }
  }

  private val voiceInstructionsObserver = VoiceInstructionsObserver { instructions ->
    val text = instructions.announcement().orEmpty().ifBlank { instructions.ssmlAnnouncement().orEmpty() }
    if (text.isNotBlank()) sendEvent("onVoiceInstruction", mapOf("text" to text))
  }

  override fun definition() = ModuleDefinition {
    Name("AdiVMapboxBridge")
    Events("onOfflineProgress", "onRouteProgress", "onRouteChanged", "onOffRoute", "onArrival", "onVoiceInstruction", "onGuidanceError")

    AsyncFunction("configureSharedTileStore") { token: String, promise: Promise ->
      try {
        configureStore(token)
        promise.resolve(mapOf("configured" to true, "mapsSdkVersion" to MAPS_SDK_VERSION, "navigationSdkVersion" to NAVIGATION_SDK_VERSION))
      } catch (error: Throwable) {
        promise.reject("E_MAPBOX_STORE", error.message ?: "Mapbox TileStore could not initialize.", error)
      }
    }.runOnQueue(Queues.MAIN)

    AsyncFunction("prepareNavigation") { token: String, promise: Promise ->
      try {
        configureStore(token)
        prepareNavigation()
        promise.resolve("ready")
      } catch (error: Throwable) {
        promise.reject("E_MAPBOX_INIT", error.message ?: "Mapbox Navigation could not initialize.", error)
      }
    }.runOnQueue(Queues.MAIN)

    AsyncFunction("requestRoute") { fromLon: Double, fromLat: Double, toLon: Double, toLat: Double, offlineOnly: Boolean, promise: Promise ->
      try {
        val nav = prepareNavigation()
        val options = RouteOptions.builder()
          .applyDefaultNavigationOptions(ROUTING_PROFILE)
          .coordinatesList(listOf(Point.fromLngLat(fromLon, fromLat), Point.fromLngLat(toLon, toLat)))
          .alternatives(false)
          .language("en")
          .voiceUnits("metric")
          .geometries(DirectionsCriteria.GEOMETRY_POLYLINE6)
          .build()

        requestRoutesWithTimeout(
          nav = nav,
          options = options,
          offlineOnly = offlineOnly,
          onRoutesReady = { routeList, routerOrigin ->
            val source = when {
              routerOrigin.equals(RouterOrigin.OFFLINE, ignoreCase = true) -> "offline"
              routerOrigin.equals(RouterOrigin.ONLINE, ignoreCase = true) -> "online"
              else -> "unknown"
            }
            if (offlineOnly && source != "offline") {
              promise.reject("E_ROUTE_NOT_OFFLINE", "Mapbox did not calculate this route from offline routing tiles.", null)
            } else {
              val routeId = UUID.randomUUID().toString()
              routes[routeId] = StoredRoute(routeList, source, Point.fromLngLat(toLon, toLat))
              promise.resolve(routePayload(routeId, routeList, source))
            }
          },
          onFailure = { reasons ->
            promise.reject("E_ROUTE_FAILED", reasons.joinToString { it.message }, null)
          },
          onCanceled = {
            promise.reject("E_ROUTE_CANCELED", "Mapbox route request was canceled.", null)
          },
          onTimeout = {
            promise.reject("E_ROUTE_TIMEOUT", "Mapbox route calculation timed out.", null)
          },
        )
      } catch (error: Throwable) {
        promise.reject("E_MAPBOX_ROUTE", error.message ?: "Mapbox could not calculate a route.", error)
      }
    }.runOnQueue(Queues.MAIN)

    AsyncFunction("startGuidance") { routeId: String, offlineOnly: Boolean, promise: Promise ->
      try {
        val route = routes[routeId] ?: throw IllegalStateException("The planned Mapbox route is no longer available. Plan it again.")
        if (offlineOnly && route.source != "offline") throw IllegalStateException("Offline guidance requires a route confirmed as locally calculated.")
        val nav = prepareNavigation()
        unregisterGuidanceObservers(nav)
        nav.setNavigationRoutes(emptyList())
        registerGuidanceObservers(nav)
        activeRouteId = routeId
        activeOfflineOnly = offlineOnly
        offlineRerouteInProgress = false
        offlineRerouteWaitingForLocation = false
        latestLocation = null
        nav.setRerouteEnabled(!offlineOnly)
        nav.startTripSession()
        tripSessionStarted = true
        nav.setNavigationRoutes(route.routes)
        promise.resolve(null)
      } catch (error: Throwable) {
        promise.reject("E_GUIDANCE_START", error.message ?: "Mapbox guidance could not start.", error)
      }
    }.runOnQueue(Queues.MAIN)

    Function("stopGuidance") {
      runOnMain {
        val nav = navigation ?: return@runOnMain
        unregisterGuidanceObservers(nav)
        nav.setNavigationRoutes(emptyList())
        if (tripSessionStarted) nav.stopTripSession()
        tripSessionStarted = false
        nav.setRerouteEnabled(true)
        activeRouteId = null
        activeOfflineOnly = false
        offlineRerouteInProgress = false
        offlineRerouteWaitingForLocation = false
        latestLocation = null
      }
    }

    Function("releaseRoute") { routeId: String ->
      if (routeId != activeRouteId) routes.remove(routeId)
    }

    AsyncFunction("loadRegion") { regionId: String, geometryJson: String, styleUri: String, minZoom: Int, maxZoom: Int, promise: Promise ->
      try {
        require(regionId.matches(Regex("[A-Za-z0-9_-]{1,80}"))) { "The offline region name is invalid." }
        require(minZoom in 0..18 && maxZoom in minZoom..22) { "The requested zoom range is invalid." }
        val manager = OfflineManager()
        val store = tileStore ?: throw IllegalStateException("The Mapbox tile store is not configured.")
        val nav = prepareNavigation()
        val polygon = Polygon.fromJson(geometryJson)
        val styleOptions = StylePackLoadOptions.Builder()
          .glyphsRasterizationMode(GlyphsRasterizationMode.IDEOGRAPHS_RASTERIZED_LOCALLY)
          .metadata(Value.valueOf(hashMapOf(
            "regionId" to Value.valueOf(regionId),
            "app" to Value.valueOf("AdiV"),
          )))
          .acceptExpired(false)
          .build()

        downloads["style:$regionId"] = manager.loadStylePack(
          styleUri,
          styleOptions,
          StylePackLoadProgressCallback { progress ->
            sendOfflineProgress(regionId, "style", progress.completedResourceCount, progress.requiredResourceCount)
          },
          StylePackCallback { expected ->
            expected.fold(
              { error ->
                downloads.remove("style:$regionId")
                promise.reject("E_STYLE_DOWNLOAD", error.message, null)
              },
              { _: StylePack ->
                appContext().getSharedPreferences("adiv-mapbox-offline", Context.MODE_PRIVATE)
                  .edit().putBoolean("style:$regionId", true).apply()
                runOnMain { loadMapAndRoutingRegion(manager, store, nav, regionId, polygon, styleUri, minZoom, maxZoom, promise) }
              },
            )
          },
        )
      } catch (error: Throwable) {
        promise.reject("E_REGION_DOWNLOAD", error.message ?: "Mapbox offline download could not start.", error)
      }
    }.runOnQueue(Queues.MAIN)

    AsyncFunction("estimateRegion") { regionId: String, geometryJson: String, styleUri: String, minZoom: Int, maxZoom: Int, promise: Promise ->
      try {
        require(regionId.matches(Regex("[A-Za-z0-9_-]{1,80}"))) { "The offline region name is invalid." }
        require(minZoom in 0..18 && maxZoom in minZoom..22) { "The requested zoom range is invalid." }
        val manager = OfflineManager()
        val store = tileStore ?: throw IllegalStateException("The Mapbox tile store is not configured.")
        val nav = prepareNavigation()
        val polygon = Polygon.fromJson(geometryJson)
        val options = createRegionLoadOptions(manager, nav, regionId, polygon, styleUri, minZoom, maxZoom)
        downloads["estimate:$regionId"] = store.estimateTileRegion(
          regionId,
          options,
          { progress: TileRegionEstimateProgress ->
            sendEvent("onOfflineProgress", mapOf(
              "regionId" to regionId,
              "asset" to "estimate",
              "completed" to progress.completedResourceCount,
              "required" to progress.requiredResourceCount,
              "percent" to if (progress.requiredResourceCount <= 0) 0 else ((progress.completedResourceCount.toDouble() / progress.requiredResourceCount) * 100).toInt().coerceIn(0, 100),
              "storageSizeBytes" to progress.partialResult.storageSize,
              "transferSizeBytes" to progress.partialResult.transferSize,
              "errorMargin" to progress.partialResult.errorMargin,
            ))
          },
          { expected ->
            expected.fold(
              { error ->
                downloads.remove("estimate:$regionId")
                promise.reject("E_REGION_ESTIMATE", error.message, null)
              },
              { result ->
                downloads.remove("estimate:$regionId")
                promise.resolve(mapOf(
                  "storageSizeBytes" to result.storageSize,
                  "transferSizeBytes" to result.transferSize,
                  "errorMargin" to result.errorMargin,
                ))
              },
            )
          },
        )
      } catch (error: Throwable) {
        downloads.remove("estimate:$regionId")
        promise.reject("E_REGION_ESTIMATE", error.message ?: "Mapbox could not estimate this offline region.", error)
      }
    }.runOnQueue(Queues.MAIN)

    Function("cancelRegion") { regionId: String ->
      runOnMain {
        downloads.remove("style:$regionId")?.cancel()
        downloads.remove("tiles:$regionId")?.cancel()
        downloads.remove("estimate:$regionId")?.cancel()
      }
    }

    AsyncFunction("getRegionStatus") { regionId: String, promise: Promise ->
      val store = tileStore
      if (store == null) {
        promise.resolve(mapOf("regionId" to regionId, "styleReady" to false, "mapTilesReady" to false, "routingTilesReady" to false))
      } else {
        store.getTileRegion(regionId) { expected ->
          val prefs = appContext().getSharedPreferences("adiv-mapbox-offline", Context.MODE_PRIVATE)
          val styleReady = prefs.getBoolean("style:$regionId", false)
          expected.fold(
            { _ ->
              promise.resolve(mapOf("regionId" to regionId, "styleReady" to styleReady, "mapTilesReady" to false, "routingTilesReady" to false))
            },
            { region ->
              val assetsReady = prefs.getBoolean("map:$regionId", false) &&
                prefs.getBoolean("routing:$regionId", false) &&
                region.completedResourceCount >= region.requiredResourceCount
              runOnMain {
                store.getTileRegionMetadata(regionId) { metadataResult ->
                  val metadataJson = metadataResult.fold({ _ -> "{}" }, { value -> value.toJson() })
                  promise.resolve(mapOf(
                    "regionId" to regionId,
                    "styleReady" to styleReady,
                    "mapTilesReady" to assetsReady,
                    "routingTilesReady" to assetsReady,
                    "tileRegionBytes" to region.completedResourceSize,
                    "metadataJson" to metadataJson,
                    "mapsSdkVersion" to prefs.getString("mapsVersion:$regionId", MAPS_SDK_VERSION),
                    "navigationSdkVersion" to prefs.getString("navigationVersion:$regionId", NAVIGATION_SDK_VERSION),
                    "routingProfile" to prefs.getString("profile:$regionId", ROUTING_PROFILE),
                    "lastUpdatedAt" to prefs.getLong("updatedAt:$regionId", 0L),
                  ))
                }
              }
            },
          )
        }
      }
    }.runOnQueue(Queues.MAIN)

    AsyncFunction("removeRegion") { regionId: String, styleUri: String, promise: Promise ->
      val store = tileStore
      if (store == null) {
        promise.resolve(null)
      } else {
        store.removeTileRegion(regionId)
        val prefs = appContext().getSharedPreferences("adiv-mapbox-offline", Context.MODE_PRIVATE)
        prefs.edit()
          .putBoolean("style:$regionId", false)
          .putBoolean("map:$regionId", false)
          .putBoolean("routing:$regionId", false)
          .remove("bytes:$regionId")
          .remove("updatedAt:$regionId")
          .remove("mapsVersion:$regionId")
          .remove("navigationVersion:$regionId")
          .remove("profile:$regionId")
          .apply()
        OfflineManager().removeStylePack(styleUri)
        promise.resolve(null)
      }
    }.runOnQueue(Queues.MAIN)
  }

  private fun appContext(): Context = appContext.reactContext?.applicationContext
    ?: throw IllegalStateException("Android application context is unavailable.")

  private fun runOnMain(block: () -> Unit) {
    if (Looper.myLooper() == Looper.getMainLooper()) {
      block()
    } else {
      Handler(Looper.getMainLooper()).post(block)
    }
  }

  @Synchronized
  private fun configureStore(token: String): TileStore {
    require(token.startsWith("pk.")) { "Mapbox needs a public pk. access token." }
    val context = appContext()
    val existing = tileStore
    if (existing != null) return existing
    val directory = File(context.filesDir, "adiv-mapbox-tile-store")
    if (!directory.exists() && !directory.mkdirs()) throw IllegalStateException("The Mapbox tile storage folder could not be created.")
    TileStore.setRootPath(directory.absolutePath).fold(
      { error -> throw IllegalStateException("The Mapbox tile storage path could not be set: $error") },
      { Unit },
    )
    val created = TileStore.create()
    MapboxMapsOptions.tileStore = created
    MapboxOptions.accessToken = token
    tileStore = created
    return created
  }

  @Synchronized
  private fun prepareNavigation(): MapboxNavigation {
    navigation?.let { return it }
    val store = tileStore ?: throw IllegalStateException("Configure the Mapbox tile store first.")
    val context = appContext()
    val options = NavigationOptions.Builder(context)
      .routingTilesOptions(RoutingTilesOptions.Builder().tileStore(store).tilesProfile(ROUTING_PROFILE).build())
      .build()
    val created = if (MapboxNavigationProvider.isCreated()) {
      MapboxNavigationProvider.retrieve()
    } else {
      MapboxNavigationProvider.create(options)
    }
    navigation = created
    return created
  }

  private fun registerGuidanceObservers(nav: MapboxNavigation) {
    nav.registerLocationObserver(locationObserver)
    nav.registerRouteProgressObserver(routeProgressObserver)
    nav.registerRoutesObserver(routesObserver)
    nav.registerOffRouteObserver(offRouteObserver)
    nav.registerArrivalObserver(arrivalObserver)
    nav.registerVoiceInstructionsObserver(voiceInstructionsObserver)
    observersRegistered = true
  }

  private fun unregisterGuidanceObservers(nav: MapboxNavigation) {
    if (!observersRegistered) return
    nav.unregisterLocationObserver(locationObserver)
    nav.unregisterRouteProgressObserver(routeProgressObserver)
    nav.unregisterRoutesObserver(routesObserver)
    nav.unregisterOffRouteObserver(offRouteObserver)
    nav.unregisterArrivalObserver(arrivalObserver)
    nav.unregisterVoiceInstructionsObserver(voiceInstructionsObserver)
    observersRegistered = false
  }

  private fun requestOfflineReroute() {
    if (offlineRerouteInProgress) return
    val currentRoute = activeRouteId?.let(routes::get) ?: return
    val location = latestLocation ?: run {
      offlineRerouteWaitingForLocation = true
      return
    }
    offlineRerouteInProgress = true
    val options = RouteOptions.builder()
      .applyDefaultNavigationOptions(ROUTING_PROFILE)
      .coordinatesList(listOf(
        Point.fromLngLat(location.longitude, location.latitude),
        currentRoute.destination,
      ))
      .alternatives(false)
      .language("en")
      .voiceUnits("metric")
      .geometries(DirectionsCriteria.GEOMETRY_POLYLINE6)
      .build()
    val nav = navigation ?: run {
      offlineRerouteInProgress = false
      return
    }
    try {
      requestRoutesWithTimeout(
        nav = nav,
        options = options,
        offlineOnly = true,
        onRoutesReady = { routeList, routerOrigin ->
        offlineRerouteInProgress = false
        if (!routerOrigin.equals(RouterOrigin.OFFLINE, ignoreCase = true)) {
          sendEvent("onGuidanceError", mapOf("message" to "Offline rerouting did not return a locally calculated route. Guidance is paused; recording continues."))
          stopTripSessionAfterOfflineRerouteFailure(nav)
        } else {
          val routeId = UUID.randomUUID().toString()
          val updated = StoredRoute(routeList, "offline", currentRoute.destination)
          routes[routeId] = updated
          activeRouteId = routeId
          nav.setNavigationRoutes(routeList)
          sendEvent("onRouteChanged", routePayload(routeId, routeList, "offline"))
        }
        },
        onFailure = { _ ->
          offlineRerouteInProgress = false
          sendEvent("onGuidanceError", mapOf("message" to "Offline rerouting failed. Guidance is paused; recording continues."))
          stopTripSessionAfterOfflineRerouteFailure(nav)
        },
        onCanceled = {
          offlineRerouteInProgress = false
          sendEvent("onGuidanceError", mapOf("message" to "Offline rerouting was canceled. Guidance is paused; recording continues."))
          stopTripSessionAfterOfflineRerouteFailure(nav)
        },
        onTimeout = {
          offlineRerouteInProgress = false
          sendEvent("onGuidanceError", mapOf("message" to "Offline rerouting timed out. Guidance is paused; recording continues."))
          stopTripSessionAfterOfflineRerouteFailure(nav)
        },
      )
    } catch (error: Throwable) {
      offlineRerouteInProgress = false
      sendEvent("onGuidanceError", mapOf("message" to "Offline rerouting failed. Guidance is paused; recording continues."))
      stopTripSessionAfterOfflineRerouteFailure(nav)
    }
  }

  private fun stopTripSessionAfterOfflineRerouteFailure(nav: MapboxNavigation) {
    nav.setNavigationRoutes(emptyList())
    if (tripSessionStarted) nav.stopTripSession()
    tripSessionStarted = false
    activeRouteId = null
    activeOfflineOnly = false
    offlineRerouteWaitingForLocation = false
  }

  private fun requestRoutesWithTimeout(
    nav: MapboxNavigation,
    options: RouteOptions,
    offlineOnly: Boolean,
    onRoutesReady: (List<NavigationRoute>, String) -> Unit,
    onFailure: (List<RouterFailure>) -> Unit,
    onCanceled: () -> Unit,
    onTimeout: () -> Unit,
  ) {
    val restoreOfflineNetwork = if (offlineOnly) beginOfflineOnlyRouteRequest() else null
    val completed = AtomicBoolean(false)
    val handler = Handler(Looper.getMainLooper())
    var requestId = 0L
    val timeout = Runnable {
      if (completed.compareAndSet(false, true)) {
        restoreOfflineNetwork?.invoke()
        if (requestId != 0L) nav.cancelRouteRequest(requestId)
        onTimeout()
      }
    }
    fun finish(): Boolean {
      if (!completed.compareAndSet(false, true)) return false
      handler.removeCallbacks(timeout)
      restoreOfflineNetwork?.invoke()
      return true
    }

    try {
      requestId = nav.requestRoutes(options, object : NavigationRouterCallback {
        override fun onRoutesReady(routeList: List<NavigationRoute>, routerOrigin: String) {
          if (finish()) onRoutesReady(routeList, routerOrigin)
        }

        override fun onFailure(reasons: List<RouterFailure>, routeOptions: RouteOptions) {
          if (finish()) onFailure(reasons)
        }

        override fun onCanceled(routeOptions: RouteOptions, routerOrigin: String) {
          if (finish()) onCanceled()
        }
      })
      if (!completed.get()) handler.postDelayed(timeout, OFFLINE_ROUTE_TIMEOUT_MS)
    } catch (error: Throwable) {
      finish()
      throw error
    }
  }

  private fun routePayload(routeId: String, routeList: List<NavigationRoute>, source: String): Map<String, Any> {
    val route = routeList.first().directionsRoute
    val geometry = route.geometry() ?: throw IllegalStateException("Mapbox returned a route without geometry.")
    val precision = if (route.routeOptions()?.geometries() == DirectionsCriteria.GEOMETRY_POLYLINE) Constants.PRECISION_5 else Constants.PRECISION_6
    val coordinates = LineString.fromPolyline(geometry, precision).coordinates().map { listOf(it.longitude(), it.latitude()) }
    val steps = route.legs().orEmpty().flatMap { leg ->
      leg.steps().orEmpty().mapNotNull { step ->
        val maneuver = step.maneuver() ?: return@mapNotNull null
        val location = maneuver.location() ?: return@mapNotNull null
        mapOf(
          "text" to (maneuver.instruction() ?: "Continue"),
          "distanceMeters" to step.distance(),
          "lon" to location.longitude(),
          "lat" to location.latitude(),
        )
      }
    }
    return mapOf(
      "routeId" to routeId,
      "source" to source,
      "distanceMeters" to (route.distance() ?: 0.0),
      "durationSeconds" to (route.duration() ?: 0.0),
      "coordinates" to coordinates,
      "steps" to steps,
    )
  }

  private fun loadMapAndRoutingRegion(
    manager: OfflineManager,
    store: TileStore,
    nav: MapboxNavigation,
    regionId: String,
    geometry: Polygon,
    styleUri: String,
    minZoom: Int,
    maxZoom: Int,
    promise: Promise,
  ) {
    try {
      val options = createRegionLoadOptions(manager, nav, regionId, geometry, styleUri, minZoom, maxZoom)
      downloads["tiles:$regionId"] = store.loadTileRegion(
        regionId,
        options,
        { progress: TileRegionLoadProgress ->
          sendOfflineProgress(regionId, "map-and-routing", progress.completedResourceCount, progress.requiredResourceCount)
        },
        { expected ->
          expected.fold(
            { error: TileRegionError ->
              downloads.remove("style:$regionId")
              downloads.remove("tiles:$regionId")
              promise.reject("E_TILE_DOWNLOAD", error.message, null)
            },
            { region: TileRegion ->
              val completedAt = System.currentTimeMillis()
              downloads.remove("style:$regionId")
              downloads.remove("tiles:$regionId")
              appContext().getSharedPreferences("adiv-mapbox-offline", Context.MODE_PRIVATE).edit()
                .putBoolean("map:$regionId", true)
                .putBoolean("routing:$regionId", true)
                .putLong("bytes:$regionId", region.completedResourceSize)
                .putLong("updatedAt:$regionId", completedAt)
                .putString("mapsVersion:$regionId", MAPS_SDK_VERSION)
                .putString("navigationVersion:$regionId", NAVIGATION_SDK_VERSION)
                .putString("profile:$regionId", ROUTING_PROFILE)
                .apply()
              sendEvent("onOfflineProgress", mapOf("regionId" to regionId, "asset" to "complete", "percent" to 100))
              promise.resolve(mapOf(
                "regionId" to regionId,
                "styleReady" to true,
                "mapTilesReady" to true,
                "routingTilesReady" to true,
                "tileRegionBytes" to region.completedResourceSize,
                "mapsSdkVersion" to MAPS_SDK_VERSION,
                "navigationSdkVersion" to NAVIGATION_SDK_VERSION,
                "routingProfile" to ROUTING_PROFILE,
                "lastUpdatedAt" to completedAt,
              ))
            },
          )
        },
      )
    } catch (error: Throwable) {
      downloads.remove("style:$regionId")
      promise.reject("E_TILE_DOWNLOAD", error.message ?: "Mapbox map and routing tiles could not be loaded.", error)
    }
  }

  private fun createRegionLoadOptions(
    manager: OfflineManager,
    nav: MapboxNavigation,
    regionId: String,
    geometry: Polygon,
    styleUri: String,
    minZoom: Int,
    maxZoom: Int,
  ): TileRegionLoadOptions {
    val mapDescriptor = manager.createTilesetDescriptor(
      TilesetDescriptorOptions.Builder()
        .styleURI(styleUri)
        .minZoom(minZoom.toByte())
        .maxZoom(maxZoom.toByte())
        .pixelRatio(appContext().resources.displayMetrics.density)
        .build(),
    )
    val routingDescriptor = nav.tilesetDescriptorFactory.getLatest()
    return TileRegionLoadOptions.Builder()
      .geometry(geometry)
      .descriptors(listOf(mapDescriptor, routingDescriptor))
      .metadata(Value.valueOf(hashMapOf(
        "regionId" to Value.valueOf(regionId),
        "styleUri" to Value.valueOf(styleUri),
        "assets" to Value.valueOf("map-and-navigation"),
        "routingProfile" to Value.valueOf(ROUTING_PROFILE),
        "mapsSdkVersion" to Value.valueOf(MAPS_SDK_VERSION),
        "navigationSdkVersion" to Value.valueOf(NAVIGATION_SDK_VERSION),
        "routingTilesVersion" to Value.valueOf("latest-at-download-time"),
      )))
      .acceptExpired(false)
      .build()
  }

  private fun beginOfflineOnlyRouteRequest(): () -> Unit {
    synchronized(offlineRouteLock) {
      if (offlineRouteRequestCount == 0) {
        val offlineSwitch = OfflineSwitch.getInstance()
        mapboxStackConnectedBeforeOfflineRoute = offlineSwitch.isMapboxStackConnected
        offlineSwitch.isMapboxStackConnected = false
      }
      offlineRouteRequestCount += 1
    }
    var restored = false
    return {
      synchronized(offlineRouteLock) {
        if (!restored) {
          restored = true
          offlineRouteRequestCount = (offlineRouteRequestCount - 1).coerceAtLeast(0)
          if (offlineRouteRequestCount == 0) {
            OfflineSwitch.getInstance().isMapboxStackConnected = mapboxStackConnectedBeforeOfflineRoute
          }
        }
      }
    }
  }

  private fun sendOfflineProgress(regionId: String, asset: String, completed: Long, required: Long) {
    val percentage = if (required <= 0) 0 else ((completed.toDouble() / required) * 100).toInt().coerceIn(0, 100)
    sendEvent("onOfflineProgress", mapOf("regionId" to regionId, "asset" to asset, "completed" to completed, "required" to required, "percent" to percentage))
  }
}
